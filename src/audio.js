// Procedural audio via the Web Audio API — no asset files. Provides an evolving low
// drone per scene plus one-shot bell "pings" and low "booms" that scenes trigger on events.
// The context starts suspended (autoplay policy); resumeAudio() is called on a user gesture
// (VR session start / pointer down).
let _ctx = null;
let _master = null;

export function audioContext() {
  if (_ctx) return _ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  _ctx = new AC();
  _master = _ctx.createGain();
  _master.gain.value = 0.5;
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

// Evolving low drone: detuned oscillators through a lowpass with a slow LFO on the cutoff.
// Restartable (start() builds fresh nodes, stop() ramps down and tears them down).
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
    out.gain.linearRampToValueAtTime(gain, t + 2.0); // fade in
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

// One-shot bell/chime: a few decaying partials (inharmonic partials → metallic).
export function ping({ freq = 880, dur = 1.2, gain = 0.15, partials = [1, 2, 3, 4.2] } = {}) {
  const ctx = audioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(gain, t);
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(master());
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

// One-shot low boom/thud (e.g. a heartbeat or explosion).
export function boom({ freq = 60, dur = 0.5, gain = 0.5 } = {}) {
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
  g.connect(master());
  o.start(t);
  o.stop(t + dur + 0.05);
}
