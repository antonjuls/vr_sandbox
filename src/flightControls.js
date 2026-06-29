import * as THREE from "three";
import { getPads, thumb, button } from "./input.js";
import { createFlight } from "./flight.js";
import { SMOOTH_TURN, SMOOTH_SPEED, SNAP_ANGLE, DEADZONE, FLY_SPEED } from "./config.js";

// Shared flight movement for all non-grounded scenes, so controls feel identical:
//   right stick → turn the view (yaw around the head)
//   left stick  → free-fly relative to gaze (full 3D: look up to climb, down to dive)
//   left grip   → warp dash forward; right B → sprint the free-fly
// Returns warp intensity (0..1) for per-scene visuals.
export function createFlightControls(renderer, dolly, opts = {}) {
  const flySpeed = opts.flySpeed ?? FLY_SPEED;
  const flight = createFlight(renderer, dolly);
  let snapReady = true;

  const _q = new THREE.Quaternion();
  const _yAxis = new THREE.Vector3(0, 1, 0);
  const _pivot = new THREE.Vector3();
  const _camQ = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();
  const _rgt = new THREE.Vector3();
  const _move = new THREE.Vector3();

  function turnAroundHead(angle) {
    const xrCam = renderer.xr.getCamera();
    _pivot.setFromMatrixPosition(xrCam.matrixWorld);
    _q.setFromAxisAngle(_yAxis, angle);
    dolly.position.sub(_pivot).applyQuaternion(_q).add(_pivot);
    dolly.quaternion.premultiply(_q);
  }

  function update(dt) {
    const { left, right } = getPads(renderer);

    // turn (right stick) — same scheme as grounded locomotion
    const rs = thumb(right);
    if (SMOOTH_TURN) {
      if (Math.abs(rs.x) > DEADZONE) turnAroundHead(-rs.x * SMOOTH_SPEED * dt);
    } else {
      if (Math.abs(rs.x) > 0.7 && snapReady) {
        turnAroundHead(-Math.sign(rs.x) * SNAP_ANGLE);
        snapReady = false;
      } else if (Math.abs(rs.x) < 0.3) {
        snapReady = true;
      }
    }

    // free-fly (left stick, gaze-relative, full 3D)
    const ls = thumb(left);
    if (Math.hypot(ls.x, ls.y) > DEADZONE) {
      const cam = renderer.xr.getCamera();
      _camQ.setFromRotationMatrix(cam.matrixWorld);
      _fwd.set(0, 0, -1).applyQuaternion(_camQ);
      _rgt.set(1, 0, 0).applyQuaternion(_camQ);
      _move.set(0, 0, 0).addScaledVector(_fwd, -ls.y).addScaledVector(_rgt, ls.x);
      if (_move.lengthSq() > 0) {
        _move.normalize();
        const sp = button(right, 5) ? flySpeed * 4 : flySpeed; // B sprints the fly
        dolly.position.addScaledVector(_move, sp * dt);
      }
    }

    // warp dash (left grip)
    return flight.update(dt, button(left, 1) ? 1 : 0);
  }

  function reset() {
    flight.reset();
    snapReady = true;
  }

  return { update, reset };
}
