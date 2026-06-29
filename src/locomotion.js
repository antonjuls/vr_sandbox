import * as THREE from "three";
import {
  SPEED,
  SMOOTH_TURN,
  SNAP_ANGLE,
  SMOOTH_SPEED,
  DEADZONE,
} from "./config.js";

// Locomotion: left stick — move relative to gaze, right stick — turn.
// Moving/rotating the dolly drives the whole player through the world; tracking applies on top.
export function createLocomotion(renderer, dolly) {
  let snapReady = true;

  // reusable objects (no per-frame allocations)
  const _pivot = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _fwd = new THREE.Vector3();
  const _rgt = new THREE.Vector3();
  const _move = new THREE.Vector3();
  const _camQ = new THREE.Quaternion();

  function getPads() {
    let left = null;
    let right = null;
    const s = renderer.xr.getSession();
    if (s) {
      for (const src of s.inputSources) {
        if (!src.gamepad) continue;
        if (src.handedness === "left") left = src.gamepad;
        else if (src.handedness === "right") right = src.gamepad;
      }
    }
    return { left, right };
  }

  function thumb(gp) {
    if (!gp) return { x: 0, y: 0 };
    const a = gp.axes;
    if (a.length >= 4) return { x: a[2], y: a[3] }; // on Quest the stick is axes 2/3
    if (a.length >= 2) return { x: a[0], y: a[1] };
    return { x: 0, y: 0 };
  }

  // rotate the rig around the world-space head position
  function turnAroundHead(angle) {
    const xrCam = renderer.xr.getCamera();
    _pivot.setFromMatrixPosition(xrCam.matrixWorld);
    _q.setFromAxisAngle(_yAxis, angle);
    dolly.position.sub(_pivot).applyQuaternion(_q).add(_pivot);
    dolly.quaternion.premultiply(_q);
  }

  function update(dt) {
    const { left, right } = getPads();

    // move relative to gaze direction (horizontal plane)
    const ls = thumb(left);
    if (Math.hypot(ls.x, ls.y) > DEADZONE) {
      const xrCam = renderer.xr.getCamera();
      _camQ.setFromRotationMatrix(xrCam.matrixWorld);
      _fwd.set(0, 0, -1).applyQuaternion(_camQ);
      _fwd.y = 0;
      _fwd.normalize();
      _rgt.set(1, 0, 0).applyQuaternion(_camQ);
      _rgt.y = 0;
      _rgt.normalize();
      _move
        .set(0, 0, 0)
        .addScaledVector(_fwd, -ls.y) // stick up (-1) → forward
        .addScaledVector(_rgt, ls.x);
      if (_move.lengthSq() > 0) {
        _move.normalize();
        dolly.position.addScaledVector(_move, SPEED * dt);
      }
    }

    // turn with the right stick
    const rs = thumb(right);
    if (SMOOTH_TURN) {
      if (Math.abs(rs.x) > DEADZONE) turnAroundHead(-rs.x * SMOOTH_SPEED * dt);
    } else {
      if (Math.abs(rs.x) > 0.7 && snapReady) {
        turnAroundHead(-Math.sign(rs.x) * SNAP_ANGLE); // stick right → turn right
        snapReady = false;
      } else if (Math.abs(rs.x) < 0.3) {
        snapReady = true;
      }
    }
  }

  function resetSnap() {
    snapReady = true;
  }

  return { update, resetSnap };
}
