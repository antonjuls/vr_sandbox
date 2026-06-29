import * as THREE from "three";
import { CATHEDRAL } from "../config.js";

// Reusable behaviour systems for The Threshold Cathedral. Each is a tiny factory that
// operates on the architecture handles and is fed the head pose (view = {pos, dir}) each
// frame. None of them ever move the camera/dolly — the non-Euclidean unease comes from
// moving far geometry, fog and opacity only (VR comfort).

const C = CATHEDRAL;
const _to = new THREE.Vector3();

// dot of the view direction with the direction to a world point (1 = looking straight at it)
function gaze(view, point) {
  _to.copy(point).sub(view.pos);
  const len = _to.length();
  if (len < 1e-3) return 1;
  _to.multiplyScalar(1 / len);
  return _to.dot(view.dir);
}

// ---- ThresholdTriggerSystem: which zone you're in; fires an event on each crossing ----
export function createThresholdTriggers(handles, onCross) {
  const gates = handles.gates; // descending z, each with a fog target
  let idx = 0; // how many gates passed (0 = Arrival)
  function zoneFog() {
    return idx === 0 ? C.fog.arrival : gates[idx - 1].fog;
  }
  function update(view) {
    let n = 0;
    for (const g of gates) if (view.pos.z < g.z) n++;
    if (n !== idx) {
      const forward = n > idx;
      idx = n;
      onCross(zoneFog(), forward, idx === 0 ? "arrival" : gates[idx - 1].zone);
    }
  }
  function reset() {
    idx = 0;
    onCross(C.fog.arrival, false, "arrival");
  }
  return { update, reset };
}

// ---- ScaleDistortionSystem: the corridor's far end retreats and swells as you near it ----
export function createScaleDistortion(handles) {
  const end = handles.corridorEnd;
  const Z = handles.Z;
  const cl = C.corridor.length;
  let kick = 0; // transient extra distortion from a threshold pulse
  function update(dt, view) {
    if (!end) return;
    kick = THREE.MathUtils.damp(kick, 0, 1.2, dt);
    // progress through the corridor, 0..1
    const p = THREE.MathUtils.clamp((Z.corrA - view.pos.z) / cl, 0, 1);
    const targetZ = end.baseZ - p * C.scale.recede * (1 + kick) * C.scale.recedeRate * 2;
    const targetS = 1 + p * C.scale.grow + kick * 0.3;
    end.group.position.z = THREE.MathUtils.damp(end.group.position.z, targetZ, C.scale.lerp, dt);
    const s = THREE.MathUtils.damp(end.group.scale.x, targetS, C.scale.lerp, dt);
    end.group.scale.setScalar(s);
  }
  function pulse() {
    kick = 1;
  }
  return { update, pulse };
}

// ---- DistantEntitySystem: barely-there giants that vanish when stared at; void crossers ----
export function createDistantEntities(handles) {
  const E = C.entity;
  const centerZ = handles.Z.balcony;
  const ents = handles.entities;
  const vl = handles.voidLights;
  function update(dt, view) {
    for (const e of ents) {
      if (e.kind === "horizon") {
        e.angle += (E.drift / e.radius) * dt; // slow orbit at the edge of perception
        e.group.position.set(Math.cos(e.angle) * e.radius, 0, centerZ + Math.sin(e.angle) * e.radius);
        _to.copy(e.group.position);
        _to.y = E.height * 0.5;
        const staring = gaze(view, _to) > E.stareDot;
        e.target = staring ? 0 : E.visible; // look right at it → it's gone
        e.opacity = THREE.MathUtils.damp(e.opacity, e.target, E.fade, dt);
        e.mat.opacity = e.opacity;
        e.mat.visible = e.opacity > 0.01;
      } else {
        // void crosser: enormous shape drifting through the abyss
        e.mesh.position.x += e.vx * dt;
        if (e.mesh.position.x > e.range) e.mesh.position.x = -e.range;
        else if (e.mesh.position.x < -e.range) e.mesh.position.x = e.range;
        e.mesh.rotation.y += 0.02 * dt;
      }
    }
    // tiny lights far below drift slowly, like distant cities
    if (vl) {
      for (let i = 0; i < vl.n; i++) {
        vl.pos[i * 3] += 4 * dt;
        if (vl.pos[i * 3] > 800) vl.pos[i * 3] -= 1600;
      }
      vl.points.geometry.attributes.position.needsUpdate = true;
    }
  }
  return { update };
}

// ---- NonEuclideanDoorSystem: special doors turn/open only when you aren't looking ----
export function createNonEuclideanDoors(handles) {
  const doors = handles.doors;
  doors.forEach((d) => {
    d.dirSign = Math.random() < 0.5 ? 1 : -1;
    d.leafTarget = 0;
  });
  function update(dt, view) {
    for (const d of doors) {
      const watched = gaze(view, d.group.position) > 0.6;
      if (!watched) {
        d.target = d.baseRot + d.dirSign * C.doorField.nudge; // drift while unobserved
        d.leafTarget = d.dirSign * 0.25;
      }
      d.group.rotation.y = THREE.MathUtils.damp(d.group.rotation.y, d.target ?? d.baseRot, 1.4, dt);
      d.leaf.rotation.y = THREE.MathUtils.damp(d.leaf.rotation.y, d.leafTarget, 1.4, dt);
    }
  }
  // swap interiors + flip drift on doors you can't currently see (called on a threshold)
  function reshuffle(view) {
    for (const d of doors) {
      if (gaze(view, d.group.position) > 0.55) continue; // never change one in view
      d.interiors[d.shown].visible = false;
      d.shown = (d.shown + 1) % d.interiors.length;
      d.interiors[d.shown].visible = true;
      d.dirSign = -d.dirSign;
    }
  }
  return { update, reshuffle };
}

// ---- EnvironmentalObservationSystem: the architecture is faintly alive ----
// Fluorescent flicker (worse near thresholds), swaying chains, creaking suspended slabs,
// and the Breathing Archive's slow lung-like swell.
export function createObservation(handles) {
  const gates = handles.gates;
  let t = 0;
  function nearGate(z) {
    let best = 1e9;
    for (const g of gates) best = Math.min(best, Math.abs(z - g.z));
    return best;
  }
  function update(dt, view) {
    t += dt;
    // flicker — a base hum plus random stutters, intensified near a doorway
    const near = nearGate(view.pos.z) < C.light.nearThreshold ? 1 : 0;
    const depth = C.light.flicker * (0.6 + near * 0.8);
    let f = 1 - depth * (0.5 + 0.5 * Math.sin(t * 13.0)) * (0.5 + 0.5 * Math.sin(t * 7.3 + 1.7));
    if (Math.random() < 0.03 + near * 0.06) f *= 0.2; // hard dropout
    for (const l of handles.pointLights) l.light.intensity = l.base * f;
    for (const lm of handles.lamps) lm.mesh.material.emissiveIntensity = lm.base * f;

    // chains sway as if in a draught with no source
    for (const c of handles.chains) {
      c.group.rotation.x = Math.sin(t * c.rate + c.phase) * c.amp;
      c.group.rotation.z = Math.cos(t * c.rate * 0.7 + c.phase) * c.amp;
    }
    // suspended slabs drift and creak overhead
    for (const s of handles.slabs) {
      s.mesh.position.y = s.baseY + Math.sin(t * s.rate + s.phase) * s.amp;
      s.mesh.rotation.z = Math.sin(t * s.rate * 0.5 + s.phase) * 0.01;
    }
    // the archive breathes
    for (const b of handles.breathing) {
      const k = 1 + Math.sin(t * b.rate + b.phase) * b.amp;
      b.group.scale.set(1, k, 1 + (k - 1) * 0.5);
    }
  }
  return { update };
}
