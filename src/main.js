import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getPads, button } from "./input.js";
import { CAMERA_FAR } from "./config.js";
import { buildScene } from "./scene.js";
import { createPhysics } from "./physics.js";
import { setupControllers } from "./controllers.js";
import { createGrab } from "./grab.js";
import { createLocomotion } from "./locomotion.js";
import { createEffects } from "./effects.js";
import { createCosmos } from "./cosmos.js";
import { createFlight } from "./flight.js";
import { createMenu } from "./menu.js";

// Tools selectable from the menu (left X). Default tool is Warp.
const TOOLS = [
  { id: "warp", label: "Warp Drive" },
  { id: "singularity", label: "Black Hole" },
  { id: "supernova", label: "Supernova" },
  { id: "starforge", label: "Star Forge" },
  { id: "dropshape", label: "Drop Shape" },
];

let renderer, camera, dolly, clock, controls;
let scene;
let physics, grab, locomotion, controllers, effects, cosmos, flight, menu;
let activeTool = "warp";
let gripPrev = false;
let menuPrev = false;
let elapsed = 0;

init();

function init() {
  // world
  const built = buildScene();
  scene = built.scene;

  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, CAMERA_FAR);
  camera.position.set(0, 1.6, 1.6);

  // dolly — the player rig
  dolly = new THREE.Group();
  dolly.add(camera);
  scene.add(dolly);

  // gigantic cosmic backdrop + hyperspace streaks
  cosmos = createCosmos(scene, camera);

  // physics: floor already in the world, add columns + grabbable bodies
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

  // tools + input
  grab = createGrab(built.grabbables, physics);
  effects = createEffects({ scene, renderer, physics, grabbables: built.grabbables });
  flight = createFlight(renderer, dolly);
  menu = createMenu({
    scene,
    renderer,
    items: TOOLS,
    active: activeTool,
    onSelect: (id) => {
      activeTool = id;
    },
  });

  // right trigger selects a menu item while the menu is open, otherwise it grabs
  const onSelectStart = (e) => {
    if (menu.open && menu.tryClick(e.target)) return;
    grab.onSelectStart(e);
  };
  controllers = setupControllers(renderer, dolly, onSelectStart, grab.onSelectEnd);
  locomotion = createLocomotion(renderer, dolly);

  // reset the rig on VR enter/exit
  const resetRig = () => {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    locomotion.reset();
    flight.reset();
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

// left X = menu, left grip = use the active tool (hold for Warp, press for the rest)
function handleTools(dt) {
  const { left } = getPads(renderer);

  const mBtn = button(left, 4);
  if (mBtn && !menuPrev) menu.toggle();
  menuPrev = mBtn;

  const grip = button(left, 1);
  const gripJust = grip && !gripPrev;
  const thrust = activeTool === "warp" && grip ? 1 : 0;
  cosmos.setWarp(flight.update(dt, thrust));
  if (gripJust && activeTool !== "warp") {
    if (activeTool === "singularity") effects.toggleBlackHole();
    else if (activeTool === "supernova") effects.supernova();
    else if (activeTool === "starforge") effects.spawnStar();
    else if (activeTool === "dropshape") effects.spawnShape();
  }
  gripPrev = grip;

  menu.update(controllers);
}

function render() {
  const dt = clock.getDelta();
  elapsed += dt;

  if (renderer.xr.isPresenting) {
    handleTools(dt);
    locomotion.update(dt, flight.isFlying());
    grab.updateHeld(dt);
    grab.updateHover(controllers);
  } else {
    flight.update(dt, 0);
  }

  cosmos.update(dt);
  effects.update(dt);
  physics.step(dt);

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
