import { buildScene } from "../scene.js";
import { createPhysics } from "../physics.js";
import { createGrab } from "../grab.js";
import { createLocomotion } from "../locomotion.js";
import { createEffects } from "../effects.js";
import { createCosmos } from "../cosmos.js";
import { createFlight } from "../flight.js";
import { createMenu } from "../menu.js";
import { getPads, button } from "../input.js";
import { ping, boom } from "../audio.js";

// Scene 1 — "Cosmic Sandbox": the grounded physics playground (grab/throw shapes,
// gravity, columns) inside a gigantic cosmos, with warp flight and a tool menu.
const TOOLS = [
  { id: "warp", label: "Warp Drive" },
  { id: "singularity", label: "Black Hole" },
  { id: "supernova", label: "Supernova" },
  { id: "starforge", label: "Star Forge" },
  { id: "dropshape", label: "Drop Shape" },
];

export function createCosmicSandbox(ctx) {
  const { renderer, camera, dolly, controllers } = ctx;

  const built = buildScene();
  const scene = built.scene;
  const cosmos = createCosmos(scene, camera);
  const physics = createPhysics();
  built.columns.forEach((c) => physics.addColumn(c));
  built.grabbables.forEach((m) => physics.addGrabbable(m));
  physics.setCollideHandler((mesh, speed) => {
    ping({
      freq: 280 + Math.random() * 220,
      partials: [1, 2.2, 3.4],
      dur: 0.35,
      gain: Math.min(0.04 + speed * 0.02, 0.18),
      position: mesh.position,
    });
  });
  const grab = createGrab(built.grabbables, physics);
  const effects = createEffects({ scene, renderer, physics, grabbables: built.grabbables });
  const flight = createFlight(renderer, dolly);
  const locomotion = createLocomotion(renderer, dolly);

  let activeTool = "warp";
  const toolMenu = createMenu({
    renderer,
    title: "SELECT TOOL",
    items: TOOLS,
    active: activeTool,
    onSelect: (id) => (activeTool = id),
  });

  let gripPrev = false;
  let menuPrev = false;
  let elapsed = 0;

  function handleTools(dt) {
    const { left } = getPads(renderer);

    const mBtn = button(left, 4); // left X → tool menu
    if (mBtn && !menuPrev) toolMenu.toggle(scene);
    menuPrev = mBtn;

    const grip = button(left, 1); // left grip → active tool
    const gripJust = grip && !gripPrev;
    const thrust = activeTool === "warp" && grip ? 1 : 0;
    cosmos.setWarp(flight.update(dt, thrust));
    if (gripJust && activeTool !== "warp") {
      if (activeTool === "singularity") {
        effects.toggleBlackHole();
        ping({ freq: 130, dur: 1.4, gain: 0.13 });
      } else if (activeTool === "supernova") {
        effects.supernova();
        boom({ freq: 48, dur: 0.7, gain: 0.5 });
      } else if (activeTool === "starforge") {
        effects.spawnStar();
        ping({ freq: 720, dur: 1.0, gain: 0.12 });
      } else if (activeTool === "dropshape") {
        effects.spawnShape();
        ping({ freq: 520, partials: [1, 2, 3], dur: 0.4, gain: 0.1 });
      }
    }
    gripPrev = grip;

    toolMenu.update(controllers);
  }

  function update(dt) {
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
  }

  function onSelectStart(e) {
    if (toolMenu.open && toolMenu.tryClick(e.target)) return;
    const grabbed = grab.onSelectStart(e);
    if (grabbed)
      ping({ freq: 660, partials: [1, 2, 3], dur: 0.5, gain: 0.12, position: grabbed.position });
  }

  function onSelectEnd(e) {
    grab.onSelectEnd(e);
  }

  function onActivate() {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    flight.reset();
    locomotion.reset();
  }

  function onDeactivate() {
    toolMenu.close();
  }

  return {
    name: "Cosmic Sandbox",
    scene,
    update,
    onSelectStart,
    onSelectEnd,
    onActivate,
    onDeactivate,
  };
}
