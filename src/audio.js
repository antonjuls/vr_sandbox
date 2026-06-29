// Procedural audio via the Web Audio API — no asset files. Provides per-scene drones,
// one-shot bell "pings" and low "booms" (optionally 3D-positional via a PannerNode),
// a noise "wind" bed, a 3D listener synced to the head, and a global mute.
// The context starts suspended (autoplay policy); resumeAudio() runs on a user gesture.
let _ctx = null;
let _master = null;
let _muted = false;
let _vol = 0.5;

export function audioContext() {
  if (_ctx) return _ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _ctx = new AC();
  _master = _ctx.createGain();
  _master.gain.value = _vol;
  _master.connect(_ctx.destination);
  return _ctx;
}

export function resumeAudio() {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function master() {
  audioContext();
  return _master;
}

export function setMasterVolume(v) {
  _vol = v;
  if (!_master) return;
  const t = _ctx.currentTime;
  _master.gain.cancelScheduledValues(t);
  _master.gain.setValueAtTime(_master.gain.value, t);
  _master.gain.linearRampToValueAtTime(_muted ? 0 : v, t + 0.15);
}

export function toggleMute() {
  audioContext();
  if (!_master) return _muted;
  _muted = !_muted;
  const t = _ctx.currentTime;
  _master.gain.cancelScheduledValues(t);
  _master.gain.setValueAtTime(_master.gain.value, t);
  _master.gain.linearRampToValueAtTime(_muted ? 0 : _vol, t + 0.2);
  return _muted;
}

// Briefly duck the master bus, then restore — the "muffle" of crossing a threshold.
// Respects mute (never raises a muted bus). depth 0..1 of the original volume.
export function duckMaster(depth = 0.3, hold = 0.7, ramp = 0.3) {
  audioContext();
  if (!_master) return;
  const t = _ctx.currentTime;
  const target = _muted ? 0 : _vol;
  const low = _muted ? 0 : _vol * depth;
  _master.gain.cancelScheduledValues(t);
  _master.gain.setValueAtTime(_master.gain.value, t);
  _master.gain.linearRampToValueAtTime(low, t + ramp);
  _master.gain.linearRampToValueAtTime(low, t + ramp + hold);
  _master.gain.linearRampToValueAtTime(target, t + ramp + hold + ramp);
}

// move the 3D listener to the head each frame (pos + forward + up)
export function setListenerPose(px, py, pz, fx, fy, fz, ux, uy, uz) {
  const ctx = audioContext();
  if (!ctx) return;
  const L = ctx.listener;
  if (L.positionX) {
    const t = ctx.currentTime;
    L.positionX.setValueAtTime(px, t);
    L.positionY.setValueAtTime(py, t);
    L.positionZ.setValueAtTime(pz, t);
    L.forwardX.setValueAtTime(fx, t);
    L.forwardY.setValueAtTime(fy, t);
    L.forwardZ.setValueAtTime(fz, t);
    L.upX.setValueAtTime(ux, t);
    L.upY.setValueAtTime(uy, t);
    L.upZ.setValueAtTime(uz, t);
  } else {
    L.setPosition(px, py, pz);
    L.setOrientation(fx, fy, fz, ux, uy, uz);
  }
}

// destination node: a positioned PannerNode if `position` given, else the master bus
function dest(position) {
  if (!position) return master();
  const p = _ctx.createPanner();
  p.panningModel = "HRTF";
  p.distanceModel = "inverse";
  p.refDistance = 6;
  p.maxDistance = 4000;
  p.rolloffFactor = 0.5;
  if (p.positionX) {
    p.positionX.value = position.x;
    p.positionY.value = position.y;
    p.positionZ.value = position.z;
  } else {
    p.setPosition(position.x, position.y, position.z);
  }
  p.connect(master());
  return p;
}

// Evolving low drone (restartable). connect to master (ambient, non-positional).
export function createDrone(opts = {}) {
  const ctx = audioContext();
  if (!ctx) return { start() {}, stop() {}, setFreq() {} };
  const {
    freq = 55,
    type = "sine",
    voices = 3,
    detune = 6,
    cutoff = 600,
    gain = 0.18,
    lfoRate = 0.07,
    lfoDepth = 0.4,
  } = opts;
  let nodes = null;

  function start() {
    if (nodes) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    lp.connect(out);
    out.connect(master());
    const oscs = [];
    for (let i = 0; i < voices; i++) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = (i - (voices - 1) / 2) * detune;
      o.connect(lp);
      o.start();
      oscs.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = lfoRate;
    const lg = ctx.createGain();
    lg.gain.value = cutoff * lfoDepth;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();
    const t = ctx.currentTime;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(gain, t + 2.0);
    nodes = { out, oscs, lfo };
  }

  function stop() {
    if (!nodes) return;
    const { out, oscs, lfo } = nodes;
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.6);
    oscs.forEach((o) => o.stop(t + 0.7));
    lfo.stop(t + 0.7);
    nodes = null;
  }

  function setFreq(f) {
    if (!nodes) return;
    const t = ctx.currentTime;
    nodes.oscs.forEach((o) => o.frequency.setTargetAtTime(f, t, 0.3));
  }

  return { start, stop, setFreq };
}

// Looping filtered-noise wind with a slow LFO howl (restartable, ambient).
export function createWind({ gain = 0.12, cutoff = 500 } = {}) {
  const ctx = audioContext();
  if (!ctx) return { start() {}, stop() {} };
  let nodes = null;

  function start() {
    if (nodes) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = cutoff;
    bp.Q.value = 0.6;
    const out = ctx.createGain();
    out.gain.value = 0;
    src.connect(bp);
    bp.connect(out);
    out.connect(master());
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = ctx.createGain();
    lg.gain.value = cutoff * 0.6;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    src.start();
    lfo.start();
    const t = ctx.currentTime;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(gain, t + 2.5);
    nodes = { src, lfo, out };
  }

  function stop() {
    if (!nodes) return;
    const { src, lfo, out } = nodes;
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.8);
    src.stop(t + 1.0);
    lfo.stop(t + 1.0);
    nodes = null;
  }

  return { start, stop };
}

// One-shot bell/chime. opts.position → 3D-positional.
export function ping({ freq = 880, dur = 1.2, gain = 0.15, partials = [1, 2, 3, 4.2], position = null } = {}) {
  const ctx = audioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(gain, t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(dest(position));
  partials.forEach((p, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq * p;
    const g = ctx.createGain();
    g.gain.value = 1 / (i + 1);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur);
  });
}

// One-shot low boom/thud. opts.position → 3D-positional.
export function boom({ freq = 60, dur = 0.5, gain = 0.5, position = null } = {}) {
  const ctx = audioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(freq * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest(position));
  o.start(t);
  o.stop(t + dur + 0.05);
}
