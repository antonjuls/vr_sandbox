import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildScene } from "./scene.js";
import { createPhysics } from "./physics.js";
import { setupControllers } from "./controllers.js";
import { createGrab } from "./grab.js";
import { createLocomotion } from "./locomotion.js";

let renderer, camera, dolly, clock, controls;
let scene;
let physics, grab, locomotion, controllers;
let elapsed = 0;

init();

function init() {
  // world
  const built = buildScene();
  scene = built.scene;

  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 1.6, 1.6);

  // dolly — the player rig. Head, controllers and hands live inside it.
  dolly = new THREE.Group();
  dolly.add(camera);
  scene.add(dolly);

  // physics: the floor is already in the world, add columns and grabbable bodies
  physics = createPhysics();
  built.columns.forEach((c) => physics.addColumn(c));
  built.grabbables.forEach((m) => physics.addGrabbable(m));

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(
    VRButton.createButton(renderer, { optionalFeatures: ["hand-tracking"] }),
  );

  // input
  grab = createGrab(built.grabbables, physics);
  controllers = setupControllers(
    renderer,
    dolly,
    grab.onSelectStart,
    grab.onSelectEnd,
  );
  locomotion = createLocomotion(renderer, dolly);

  // reset the rig on VR enter/exit — start at the origin
  const resetRig = () => {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    locomotion.reset();
  };
  renderer.xr.addEventListener("sessionstart", resetRig);
  renderer.xr.addEventListener("sessionend", resetRig);

  // desktop orbit view
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.7, -0.8);
  controls.enableDamping = true;
  controls.update();

  clock = new THREE.Clock();
  addEventListener("resize", onResize);
  renderer.setAnimationLoop(render);
}

function render() {
  const dt = clock.getDelta();
  elapsed += dt;

  if (renderer.xr.isPresenting) {
    locomotion.update(dt);
    grab.updateHeld(dt); // drive held bodies by the controllers (before the physics step)
    grab.updateHover(controllers);
  }

  physics.step(dt); // simulate + copy body transforms onto meshes (on desktop too)

  // animated coloured lights
  const [p1, p2] = scene.userData.lights;
  p1.position.x = Math.sin(elapsed * 0.4) * 2.2;
  p2.position.x = Math.cos(elapsed * 0.5) * 2.2;

  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
