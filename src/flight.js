import * as THREE from "three";
import { WARP_ACCEL, WARP_MAX, WARP_DECAY, WARP_FLOAT_Y } from "./config.js";

// Warp flight: thrust along your gaze (full 3D — look up to climb, down to dive).
// Speed ramps up while held and bleeds off when released. While airborne the player
// floats — locomotion skips ground gravity (see isFlying).
export function createFlight(renderer, dolly) {
  let speed = 0;
  const _q = new THREE.Quaternion();
  const _fwd = new THREE.Vector3();

  // thrust ∈ [0,1]; moves the rig and returns warp intensity ∈ [0,1] (for streak visuals)
  function update(dt, thrust) {
    if (thrust > 0) speed = Math.min(speed + WARP_ACCEL * thrust * dt, WARP_MAX);
    else speed = Math.max(speed - WARP_DECAY * speed * dt - 2 * dt, 0); // ease back to 0

    if (speed > 0.01) {
      const cam = renderer.xr.getCamera();
      _q.setFromRotationMatrix(cam.matrixWorld);
      _fwd.set(0, 0, -1).applyQuaternion(_q).normalize();
      dolly.position.addScaledVector(_fwd, speed * dt);
    }
    return speed / WARP_MAX;
  }

  // true while warping or high up → the player floats instead of being pulled to the floor
  function isFlying() {
    return speed > 0.5 || dolly.position.y > WARP_FLOAT_Y;
  }

  function reset() {
    speed = 0;
  }

  return { update, isFlying, reset };
}
