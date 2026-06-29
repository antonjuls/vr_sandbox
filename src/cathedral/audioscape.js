import { createDrone, createWind, ping, boom, duckMaster } from "../audio.js";
import { CATHEDRAL } from "../config.js";

// LiminalAudioSystem for The Threshold Cathedral. Layered on top of the scene's sub-bass
// drone (owned by main): a faint fluorescent buzz, a low interior wind, and 3D-positional
// one-shots placed around the player — water dripping from far above, distant metal/concrete
// groans, footsteps that may not be yours, and very rare colossal impacts. Plus the slow
// heartbeat boom from behind the final door.
export function createAudioscape(renderer) {
  const A = CATHEDRAL.audio;
  const buzz = createDrone(A.buzz); // fluorescent hum
  const wind = createWind(A.wind); // low wind in impossible interiors
  const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);
  let dripT = rnd(A.dripEvery);
  let groanT = rnd(A.groanEvery);
  let stepT = rnd(A.stepEvery);
  let impactT = rnd(A.impactEvery);
  let running = false;

  function start() {
    if (running) return;
    running = true;
    buzz.start();
    wind.start();
  }
  function stop() {
    if (!running) return;
    running = false;
    buzz.stop();
    wind.stop();
  }

  function update(dt, view) {
    if (!running || !renderer.xr.isPresenting) return; // one-shots only while in VR
    const p = view.pos;
    dripT -= dt;
    if (dripT <= 0) {
      dripT = rnd(A.dripEvery);
      // a single drop, far overhead, lands somewhere near you
      ping({ freq: 1400 + Math.random() * 1400, dur: 0.18, gain: 0.06, partials: [1, 2.4], position: { x: p.x + (Math.random() - 0.5) * 14, y: p.y + 14 + Math.random() * 10, z: p.z + (Math.random() - 0.5) * 14 } });
    }
    groanT -= dt;
    if (groanT <= 0) {
      groanT = rnd(A.groanEvery);
      // distant metal / concrete groan — long and inharmonic
      ping({ freq: 70 + Math.random() * 60, dur: 3.4, gain: 0.13, partials: [1, 1.73, 2.61, 4.2], position: { x: p.x + (Math.random() - 0.5) * 120, y: 40 + Math.random() * 60, z: p.z - 40 - Math.random() * 160 } });
    }
    stepT -= dt;
    if (stepT <= 0) {
      stepT = rnd(A.stepEvery);
      // a footstep behind you that may or may not be yours
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 9;
      boom({ freq: 90, dur: 0.16, gain: 0.12, position: { x: p.x + Math.cos(a) * r, y: 0.2, z: p.z + Math.sin(a) * r } });
    }
    impactT -= dt;
    if (impactT <= 0) {
      impactT = rnd(A.impactEvery);
      // a colossal, very distant impact
      boom({ freq: 26, dur: 1.6, gain: 0.5, position: { x: p.x + (Math.random() - 0.5) * 600, y: -100, z: p.z - 300 - Math.random() * 900 } });
    }
  }

  // threshold "muffle" — duck everything briefly as you cross
  function muffle() {
    if (!renderer.xr.isPresenting) return;
    duckMaster(CATHEDRAL.threshold.muffle, CATHEDRAL.threshold.muffleHold, CATHEDRAL.threshold.muffleRamp);
  }

  // one thump of the heartbeat from behind the final door
  function finaleBeat(z, gain) {
    if (!renderer.xr.isPresenting) return;
    boom({ freq: 30, dur: 1.0, gain, position: { x: 0, y: 80, z: z - 20 } });
  }

  return { start, stop, update, muffle, finaleBeat };
}
