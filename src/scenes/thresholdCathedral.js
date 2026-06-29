import * as THREE from "three";
import { createLocomotion } from "../locomotion.js";
import { CATHEDRAL } from "../config.js";
import { buildCathedral } from "../cathedral/architecture.js";
import {
  createThresholdTriggers,
  createScaleDistortion,
  createDistantEntities,
  createNonEuclideanDoors,
  createObservation,
} from "../cathedral/systems.js";
import { createAudioscape } from "../cathedral/audioscape.js";
import { createCollision } from "../cathedral/collision.js";
import { createPortals } from "../cathedral/portals.js";
import { ping } from "../audio.js";

// Scene — "The Threshold Cathedral": a grounded liminal-horror promenade. You walk a single
// axis through seven monumental zones — Arrival Hall, Infinite Corridor, Stairwell of Wrong
// Angles, Observation Void, Breathing Archive, Door Field, Final Cathedral — toward a door
// ~300 m tall that was not built for humans. The dread is architectural: scale, distance,
// silence, and a space that quietly rearranges when you look away. No monsters, no jumpscares.
export function createThresholdCathedral(ctx) {
  const C = CATHEDRAL;
  const { renderer, camera, dolly } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.fog.color);
  scene.fog = new THREE.FogExp2(C.fog.color, C.fog.arrival);

  const H = buildCathedral(scene);

  const locomotion = createLocomotion(renderer, dolly, {
    speed: C.move.speed,
    sprintMultiplier: C.move.sprint,
    gravity: C.move.gravity,
    jumpSpeed: C.move.jump,
  });
  const audio = createAudioscape(renderer);
  const collision = createCollision(H.colliders, C.collide);
  const portals = createPortals(renderer, scene, camera, dolly, H.portals);

  // hand flashlight — left trigger toggles it; it attaches to the left controller on first
  // use and aims along the controller. decay 0 + no cutoff → it reaches the far giants.
  const F = C.flashlight;
  const flashGroup = new THREE.Group();
  const spot = new THREE.SpotLight(F.color, F.intensity, 0, F.angle, F.penumbra, F.decay);
  spot.visible = false;
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, -1); // aim down the controller's forward (-Z)
  flashGroup.add(spotTarget);
  spot.target = spotTarget;
  flashGroup.add(spot);
  const torch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0x202227, emissive: 0x000000 }),
  );
  torch.rotation.x = Math.PI / 2;
  flashGroup.add(torch);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.6, 8, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: F.color, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.rotation.x = -Math.PI / 2; // apex at the hand, widening forward
  beam.position.set(0, 0, -4);
  beam.visible = false;
  flashGroup.add(beam);
  let flashOn = false;
  function toggleFlash(controller) {
    if (flashGroup.parent !== controller) controller.add(flashGroup);
    flashOn = !flashOn;
    spot.visible = flashOn;
    beam.visible = flashOn;
    torch.material.emissive.setHex(flashOn ? 0x554422 : 0x000000);
  }

  // the view (head world pose) shared by all systems each frame
  const view = { pos: new THREE.Vector3(0, 1.6, H.startZ), dir: new THREE.Vector3(0, 0, -1) };
  let fogTarget = C.fog.arrival;

  const scaleDistort = createScaleDistortion(H);
  const doorsSys = createNonEuclideanDoors(H);
  const thresholds = createThresholdTriggers(H, (fog, forward) => {
    fogTarget = fog; // ease the murk toward the new zone
    if (forward) {
      audio.muffle(); // a threshold "muffle"
      scaleDistort.pulse(); // a beat of spatial distortion
      doorsSys.reshuffle(view); // the unseen doors quietly change
    }
  });
  const entitiesSys = createDistantEntities(H);
  const observe = createObservation(H);

  // ----- the final door's slow heartbeat (visual leak pulse + deep boom) -----
  let beat = 0;
  let lastC = 0;
  let thumpA = false;
  let thumpB = false;
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _o = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  raycaster.far = 70;

  function syncView() {
    const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    view.pos.setFromMatrixPosition(cam.matrixWorld);
    _q.setFromRotationMatrix(cam.matrixWorld);
    view.dir.set(0, 0, -1).applyQuaternion(_q).normalize();
  }

  function update(dt) {
    if (renderer.xr.isPresenting) locomotion.update(dt, false);
    syncView();

    // collision: push the rig so the head stays out of the walls
    const c = collision.resolve(view.pos.x, view.pos.z);
    dolly.position.x += c.x - view.pos.x;
    dolly.position.z += c.z - view.pos.z;
    view.pos.x = c.x;
    view.pos.z = c.z;

    thresholds.update(view); // may fire a crossing event (fog/muffle/reshuffle/pulse)
    scene.fog.density = THREE.MathUtils.damp(scene.fog.density, fogTarget, C.fog.lerp, dt);

    scaleDistort.update(dt, view);
    doorsSys.update(dt, view);
    entitiesSys.update(dt, view);
    observe.update(dt, view);

    // final door: heartbeat from behind it, louder the closer you stand
    const fd = H.finalDoor;
    const prox = THREE.MathUtils.clamp(1 - Math.abs(view.pos.z - fd.z) / 360, 0, 1);
    beat += dt;
    const hb = heartbeat(beat, C.audio.heartbeat);
    fd.leak.material.opacity = (0.5 + hb * 0.5) * (0.6 + prox * 0.4);
    fd.halo.material.opacity = 0.12 + hb * 0.14 * (0.4 + prox);
    const cyc = (beat % C.audio.heartbeat) / C.audio.heartbeat;
    if (cyc < lastC) {
      thumpA = false;
      thumpB = false;
    }
    if (prox > 0.06) {
      if (!thumpA && cyc > 0.1) {
        thumpA = true;
        audio.finaleBeat(fd.z, 0.45 * prox);
      }
      if (!thumpB && cyc > 0.28) {
        thumpB = true;
        audio.finaleBeat(fd.z, 0.32 * prox);
      }
    }
    lastC = cyc;

    // the door eases toward however far it's been forced (only ever a crack)
    fd.opened = THREE.MathUtils.damp(fd.opened, fd.openTarget, 2.0, dt);
    fd.left.position.x = fd.leftX0 - fd.opened * fd.crack;
    fd.right.position.x = fd.rightX0 + fd.opened * fd.crack;

    // portals: render the live windows and teleport when you step through
    portals.update();
  }

  // ----- interaction: the right-hand ray + trigger pushes on a door (it barely yields) -----
  function onSelectStart(e) {
    const controller = e.target;
    // left hand toggles the flashlight; right hand (or unknown) pushes on doors
    if (controller.userData && controller.userData.handedness === "left") {
      toggleFlash(controller);
      return;
    }
    _o.setFromMatrixPosition(controller.matrixWorld);
    _m.extractRotation(controller.matrixWorld);
    _d.set(0, 0, -1).applyMatrix4(_m).normalize();
    raycaster.set(_o, _d);
    const meshes = H.interactives.map((it) => it.mesh);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return;
    const it = H.interactives.find((i) => i.mesh === hit.object);
    if (!it) return;
    if (it.kind === "final") {
      it.door.openTarget = Math.min(1, it.door.openTarget + 0.18); // creak open a sliver more
      ping({ freq: 58, dur: 3.0, gain: 0.2, partials: [1, 1.73, 2.61, 4.2], position: { x: 0, y: 60, z: it.door.z } });
    } else {
      it.door.dirSign = -(it.door.dirSign || 1); // shove the leaf the other way
      it.door.leafTarget = it.door.dirSign * 0.5;
      ping({ freq: 120 + Math.random() * 80, dur: 1.6, gain: 0.14, partials: [1, 2.4, 3.7], position: hit.point });
    }
  }

  function onActivate() {
    dolly.position.set(0, 0, H.startZ);
    dolly.quaternion.identity();
    locomotion.reset();
    thresholds.reset();
    fogTarget = C.fog.arrival;
    scene.fog.density = C.fog.arrival;
    audio.start();
  }

  function onDeactivate() {
    audio.stop();
  }

  return { name: "The Threshold Cathedral", scene, update, onSelectStart, onActivate, onDeactivate };
}

// double-thump heartbeat envelope over `period` seconds, returns 0..~1
function heartbeat(time, period) {
  const c = (time % period) / period;
  const a = Math.exp(-Math.pow((c - 0.1) * 9.0, 2));
  const b = Math.exp(-Math.pow((c - 0.28) * 11.0, 2)) * 0.7;
  return Math.min(a + b, 1);
}
