import * as THREE from "three";
import { getPads, thumb, button } from "./input.js";
import {
  SPEED,
  SMOOTH_TURN,
  SNAP_ANGLE,
  SMOOTH_SPEED,
  DEADZONE,
  SPRINT_MULTIPLIER,
  JUMP_SPEED,
  GRAVITY,
} from "./config.js";

// Locomotion: left stick — move relative to gaze, right stick — turn.
// Moving/rotating the dolly drives the whole player through the world; tracking applies on top.
export function createLocomotion(renderer, dolly) {
  let snapReady = true;
  let vY = 0; // vertical velocity of the player rig (m/s), for jumping
  let aPrev = false; // previous A-button state (edge-detects the jump)

  // reusable objects (no per-frame allocations)
  const _pivot = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _fwd = new THREE.Vector3();
  const _rgt = new THREE.Vector3();
  const _move = new THREE.Vector3();
  const _camQ = new THREE.Quaternion();

  // rotate the rig around the world-space head position
  function turnAroundHead(angle) {
    const xrCam = renderer.xr.getCamera();
    _pivot.setFromMatrixPosition(xrCam.matrixWorld);
    _q.setFromAxisAngle(_yAxis, angle);
    dolly.position.sub(_pivot).applyQuaternion(_q).add(_pivot);
    dolly.quaternion.premultiply(_q);
  }

  function update(dt, flying) {
    const { left, right } = getPads(renderer);

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
        const speed = button(right, 5) ? SPEED * SPRINT_MULTIPLIER : SPEED; // right B = sprint
        dolly.position.addScaledVector(_move, speed * dt);
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

    // vertical channel: jump (right A) + gravity — only when grounded (skipped while flying)
    if (flying) {
      aPrev = button(right, 4);
      vY = 0;
    } else {
      if (button(right, 4) && !aPrev && dolly.position.y <= 1e-4) {
        vY = JUMP_SPEED; // jump only from the ground, on a fresh press
      }
      aPrev = button(right, 4);
      vY -= GRAVITY * dt;
      dolly.position.y += vY * dt;
      if (dolly.position.y < 0) {
        dolly.position.y = 0; // landed
        vY = 0;
      }
    }
  }

  function reset() {
    snapReady = true;
    vY = 0;
    aPrev = false;
  }

  return { update, reset };
}
