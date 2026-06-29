import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getPads, button } from "./input.js";
import { createDrone, resumeAudio } from "./audio.js";
import { CAMERA_FAR } from "./config.js";
import { setupControllers } from "./controllers.js";
import { createMenu } from "./menu.js";
import { createSceneManager } from "./sceneManager.js";
import { createCosmicSandbox } from "./scenes/cosmicSandbox.js";
import { createFractalInfinity } from "./scenes/fractalInfinity.js";
import { createMegalithDawn } from "./scenes/megalithDawn.js";
import { createFractalAbyss } from "./scenes/fractalAbyss.js";
import { createVortexStorm } from "./scenes/vortexStorm.js";
import { createClockworkTitans } from "./scenes/clockworkTitans.js";
import { createCrimsonVoid } from "./scenes/crimsonVoid.js";
import { createHyperzoom } from "./scenes/hyperzoom.js";

// Each scene is a separate, named world. The scene menu (left Y) switches between them;
// scenes keep their state when you switch away. main owns the shared rig + render loop.
const SCENES = [
  { id: "cosmic-sandbox", name: "Cosmic Sandbox", create: createCosmicSandbox },
  { id: "fractal-infinity", name: "Fractal Infinity", create: createFractalInfinity },
  { id: "megalith-dawn", name: "Megalith Dawn", create: createMegalithDawn },
  { id: "fractal-abyss", name: "Fractal Abyss", create: createFractalAbyss },
  { id: "vortex-storm", name: "Vortex Storm", create: createVortexStorm },
  { id: "clockwork-titans", name: "Clockwork Titans", create: createClockworkTitans },
  { id: "crimson-void", name: "Crimson Void", create: createCrimsonVoid },
  { id: "hyperzoom", name: "Hyperzoom", create: createHyperzoom },
];

// per-scene ambient drone (procedural low hum that sets each world's mood)
const SCENE_AUDIO = {
  "cosmic-sandbox": { freq: 110, type: "sine", cutoff: 1200, gain: 0.12 },
  "fractal-infinity": { freq: 90, type: "triangle", cutoff: 1000, gain: 0.12 },
  "megalith-dawn": { freq: 48, type: "sine", cutoff: 520, gain: 0.16 },
  "fractal-abyss": { freq: 70, type: "sawtooth", cutoff: 700, gain: 0.11 },
  "vortex-storm": { freq: 130, type: "triangle", cutoff: 1400, gain: 0.12 },
  "clockwork-titans": { freq: 55, type: "sawtooth", cutoff: 600, gain: 0.14 },
  "crimson-void": { freq: 38, type: "sine", cutoff: 420, gain: 0.18 },
  hyperzoom: { freq: 100, type: "triangle", cutoff: 1500, gain: 0.12 },
};

let renderer, camera, dolly, clock, controls, controllers;
let manager, sceneMenu;
let currentDrone = null;
let yPrev = false;

// switch scene and swap its ambient drone
function goToScene(id) {
  manager.switchTo(id);
  if (currentDrone) currentDrone.stop();
  currentDrone = createDrone(SCENE_AUDIO[id] || {});
  currentDrone.start();
}

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
  renderer.shadowMap.enabled = true; // used by Megalith Dawn for long sunrise shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    onSelect: goToScene,
  });
  goToScene("cosmic-sandbox");

  // re-place the rig on VR enter/exit via the active scene's spawn
  const reactivate = () => {
    if (manager.active && manager.active.onActivate) manager.active.onActivate();
  };
  renderer.xr.addEventListener("sessionstart", () => {
    resumeAudio(); // VR entry is a user gesture → unlock audio
    reactivate();
  });
  renderer.xr.addEventListener("sessionend", reactivate);
  addEventListener("pointerdown", resumeAudio, { once: true }); // unlock on desktop too

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
