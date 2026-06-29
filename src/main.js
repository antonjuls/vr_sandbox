import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getPads, button } from "./input.js";
import { CAMERA_FAR } from "./config.js";
import { setupControllers } from "./controllers.js";
import { createMenu } from "./menu.js";
import { createSceneManager } from "./sceneManager.js";
import { createCosmicSandbox } from "./scenes/cosmicSandbox.js";
import { createFractalInfinity } from "./scenes/fractalInfinity.js";

// Each scene is a separate, named world. The scene menu (left Y) switches between them;
// scenes keep their state when you switch away. main owns the shared rig + render loop.
const SCENES = [
  { id: "cosmic-sandbox", name: "Cosmic Sandbox", create: createCosmicSandbox },
  { id: "fractal-infinity", name: "Fractal Infinity", create: createFractalInfinity },
];

let renderer, camera, dolly, clock, controls, controllers;
let manager, sceneMenu;
let yPrev = false;

init();

function init() {
  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, CAMERA_FAR);
  camera.position.set(0, 1.6, 1.6);

  // dolly — the shared player rig (head, controllers, hands). Moved into the active scene.
  dolly = new THREE.Group();
  dolly.add(camera);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(
    VRButton.createButton(renderer, { optionalFeatures: ["hand-tracking"] }),
  );

  const ctx = { renderer, camera, dolly, controllers: null };

  // route select events: scene menu first (global), then the active scene
  const onSelectStart = (e) => {
    if (sceneMenu.open && sceneMenu.tryClick(e.target)) return;
    const a = manager.active;
    if (a && a.onSelectStart) a.onSelectStart(e);
  };
  const onSelectEnd = (e) => {
    const a = manager.active;
    if (a && a.onSelectEnd) a.onSelectEnd(e);
  };
  controllers = setupControllers(renderer, dolly, onSelectStart, onSelectEnd);
  ctx.controllers = controllers;

  manager = createSceneManager(ctx, SCENES);
  sceneMenu = createMenu({
    renderer,
    title: "SELECT SCENE",
    items: manager.list().map((s) => ({ id: s.id, label: s.name })),
    onSelect: (id) => manager.switchTo(id),
  });
  manager.switchTo("cosmic-sandbox");

  // re-place the rig on VR enter/exit via the active scene's spawn
  const reactivate = () => {
    if (manager.active && manager.active.onActivate) manager.active.onActivate();
  };
  renderer.xr.addEventListener("sessionstart", reactivate);
  renderer.xr.addEventListener("sessionend", reactivate);

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

  // global: left Y toggles the scene menu
  if (renderer.xr.isPresenting) {
    const { left } = getPads(renderer);
    const y = button(left, 5);
    if (y && !yPrev) sceneMenu.toggle(manager.active.scene);
    yPrev = y;
    sceneMenu.update(controllers);
  }

  manager.active.update(dt);

  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(manager.active.scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
