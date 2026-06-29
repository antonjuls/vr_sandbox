# CLAUDE.md — VR Shapes

WebXR playground for Meta Quest 3. Three.js + WebXR + cannon-es. **ES modules, no build step.** Multiple named scenes, switchable in-headset.

## Running
- **Desktop dev:** `python -m http.server 8080` → `http://localhost:8080/`.
  `localhost` is a secure context, so the WebXR Emulator (Chrome extension) works.
  Modules load over HTTP — you **cannot** open `index.html` via `file://` (CORS kills the imports).
- **On Quest:** needs **HTTPS** (secure context). A bare LAN `http://192.168...` won't show the Enter VR button.
  Deploy: **GitHub Pages auto-deploys from the `main` branch** → `https://antonjuls.github.io/vr_sandbox/` (pure static, no build step). Open the URL in the Quest browser → Enter VR.
- No npm/bundler. `three@0.160` and `cannon-es@0.20.0` load via an `importmap` from the jsdelivr CDN.

## Files
- `index.html` — markup, overlay, `importmap` and the entry point `<script type="module" src="./src/main.js">`.
- `src/config.js` — **all the knobs** (movement + physics + effects + simulation step). Change behaviour here.
- `src/scene.js` — the world: lights, floor, columns, stars, grabbable shapes. `buildScene()` → `{ scene, grabbables, columns }`. Also exports `randomGrabbable(pos)` for the spawner.
- `src/physics.js` — cannon-es wrapper: world, bodies, sync, grabbing. `createPhysics()`.
- `src/controllers.js` — controllers, grips, hands, ray. `setupControllers(renderer, dolly, onStart, onEnd)`.
- `src/grab.js` — ray target picking, highlight, feeding the controller pose into physics. `createGrab(grabbables, physics)`.
- `src/locomotion.js` — ground movement, turning, jump, sprint; floats while flying. `createLocomotion(renderer, dolly)`.
- `src/effects.js` — tool actions (black hole, supernova, star forge, shape drop) + particle pool. `createEffects({ scene, renderer, physics, grabbables })`.
- `src/cosmos.js` — gigantic cosmic backdrop (gas giant, sun, supermassive black hole, galaxy, deep stars) + hyperspace streaks. `createCosmos(scene, camera)`.
- `src/flight.js` — warp flight toward gaze. `createFlight(renderer, dolly)`.
- `src/menu.js` — generic floating VR list menu (tools and scene select), ray-selected. `createMenu({ renderer, items, active, onSelect, title })`; `toggle(scene)` attaches it to a scene.
- `src/input.js` — shared XR gamepad helpers: `getPads`, `thumb`, `button`.
- `src/sceneManager.js` — named-scene registry: lazy-build, cache, switch (moves the rig into the active scene). `createSceneManager(ctx, registry)`.
- `src/scenes/cosmicSandbox.js` — scene 1: the grounded physics sandbox + cosmos + tools.
- `src/scenes/fractalInfinity.js` — scene 2: a giant Menger-sponge fractal you warp through.
- `src/scenes/megalithDawn.js` — scene 3: a planet at sunrise, Moon gravity, a field of giant geometric forms (megalophobia).
- `src/scenes/fractalAbyss.js` — scene 4: a raymarched infinite fractal in a fragment shader (KIFS), flown through.
- `src/scenes/vortexStorm.js` — scene 5: a swirling storm of instanced shards.
- `src/scenes/clockworkTitans.js` — scene 6: colossal nested rotating rings and gears.
- `src/scenes/crimsonVoid.js` — scene 7: a blood-red murk of breathing dark monoliths and a throbbing heart (horror).
- `src/scenes/hyperzoom.js` — scene 8: a raymarched fractal that magnifies forever (seamless x2 self-similar zoom), rainbow palette.
- `src/flightControls.js` — shared flight movement for non-grounded scenes (right-stick turn, left-stick fly, grip warp). `createFlightControls(renderer, dolly, opts)`.
- `src/main.js` — the shell: shared rig, controllers, scene manager, scene menu (left Y), per-scene ambient drone, render loop.
- `src/audio.js` — procedural Web Audio: shared context, evolving drone, one-shot `ping`/`boom`. `createDrone` / `ping` / `boom` / `resumeAudio`.
- `sw.js` — network-first service worker (repo root): new builds load on reload; cache is an offline fallback only.
- `PROJECT.md` — what the project is, its state, the roadmap.

## Architecture
- **`dolly` (THREE.Group) = the player rig.** Children: `camera`, both controllers (`getController`), grips, hands (`getHand`).
  Moving/rotating `dolly` drives the whole player through the world; physical tracking applies on top.
  Works because three.js multiplies the XR camera's worldMatrix by `camera.parent`.
- **Scenes (`src/sceneManager.js`).** Each scene is its own `THREE.Scene` + content + `update(dt)` (plus optional `onSelectStart/End`, `onActivate/Deactivate`). The manager builds them lazily, caches them (state survives switching), and moves the shared `dolly` into the active scene. `main` renders `manager.active.scene` and forwards input/select. The scene menu (left **Y**) switches scenes. The bullets below describe the **Cosmic Sandbox** scene.
- **Physics — cannon-es (`src/physics.js`).** Every mesh gets a body; the `mesh <-> body` link lives in the `links` array.
  Each frame `step(dt)` runs `world.step(FIXED_STEP, dt, MAX_SUBSTEPS)` and **copies the body transform into the mesh** (the body is the source of truth). Floor — `CANNON.Plane`, columns — static `CANNON.Cylinder`, shapes — `Sphere`/`Box` (box = `Box`, everything else = `Sphere` from the bounding sphere).
- **Grab = kinematic body.** On grab, meshes are **NOT reparented** (there used to be `controller.attach`). On `selectstart` the shape's body becomes `KINEMATIC`, and every frame `grab.updateHeld` feeds the controller's world pose (`matrixWorld.decompose`) into `physics.updateHeld` — the body teleports onto the hand and gets the hand velocity (so it can push others). On `selectend` the body goes `DYNAMIC` again and receives the hand velocity → **throw** (capped by `MAX_THROW`). The same `select` events arrive from a hand pinch.
- **Locomotion (`src/locomotion.js`).** Gamepads via `session.inputSources` by `handedness`. Left stick — move relative to gaze (horizontal). Right — turn (smooth by default, snap behind the `SMOOTH_TURN` flag), rotating around the world-space head position. Right **A** (`buttons[4]`) — jump (vertical velocity on the rig + gravity, ground-only). Right **B** (`buttons[5]`) — sprint (speed × `SPRINT_MULTIPLIER` while held).
- **Cosmos (`src/cosmos.js`).** Gigantic far-away bodies — a colossal ringed gas giant, a sun, a supermassive black hole with a vast disk, a spiral galaxy, deep multi-layer stars — for sheer scale, plus hyperspace streak lines parented to the camera. Needs `CAMERA_FAR` large and very thin fog to be visible.
- **Warp flight (`src/flight.js`).** Left grip with the Warp tool thrusts the rig along the gaze (full 3D); speed ramps to `WARP_MAX` and bleeds off on release. Above `WARP_FLOAT_Y` (or while warping) the player floats — `locomotion.update(dt, flying)` skips ground gravity.
- **Tool menu (`src/menu.js`).** Left **X** toggles a floating panel placed ahead of gaze (oriented by copying the camera quaternion so it faces you). The right-controller ray + trigger picks a tool — `main`'s `onSelectStart` calls `menu.tryClick` before `grab`. The chosen tool is what **left grip** does.
- **Tools (`src/effects.js`).** Driven from the tool menu (not raw buttons): `toggleBlackHole` (pull/swirl/swallow via `physics.eachDynamic`/`remove`), `supernova` (radial blast), `spawnStar` (drifting mini-sun), `spawnShape`. One pooled `THREE.Points` drives all bursts; `effects.update(dt)` runs the field + particles before `physics.step`.
- **Fractal Infinity (`src/scenes/fractalInfinity.js`).** A separate scene: a colossal Menger sponge (`InstancedMesh`, depth `FRACTAL_DEPTH`) with self-similar nested copies + a field of giant ones. Left grip warps you through it, left X morphs it (wireframe / hue / spin). No physics, no floor — pure fractal.
- **Megalith Dawn (`src/scenes/megalithDawn.js`).** A separate scene: flat planet ground, a slow sunrise (a shadow-casting `DirectionalLight` that tracks the player), warm haze, and ~120 random geometric giants (standing + floating, tiny to colossal, dark silhouettes) for megalophobia. Uses `createLocomotion` with Moon gravity + 10x sprint; `renderer.shadowMap` is enabled globally for its long shadows.
- **Flight scenes** (Fractal Infinity / Abyss / Vortex Storm / Clockwork Titans / Crimson Void / Hyperzoom) share `src/flightControls.js` for identical movement: right stick turns the view, left stick free-flies along gaze, left grip warps. **Fractal Abyss** and **Hyperzoom** are fragment-shader raymarches (KIFS) on a head-centred sphere driven by the built-in `cameraPosition` — the heaviest scenes. Hyperzoom adds a seamless infinite zoom: space is scaled by `exp2(fract(uZoom))`, looping x2 (KIFS self-similarity), so it magnifies forever; warp accelerates it.
- **Audio (`src/audio.js`).** One shared Web Audio context (suspended until a gesture; `resumeAudio()` on VR start / first pointer). `main` plays a per-scene ambient drone (`SCENE_AUDIO`, swapped on switch) via `createDrone`; scenes trigger one-shot `ping`/`boom` on events (Crimson heartbeat booms, Clockwork ticks, Cosmic tool chimes).
- **Service worker (`sw.js`).** Network-first, registered from `index.html`: always fetch latest, cache as offline fallback → new scenes show up after a reload without clearing cache. The very first install still needs one reload to take control.
- **Hand tracking:** `XRHandModelFactory('spheres')` — joint primitives, no external assets. Enabled via `VRButton optionalFeatures`.

## Conventions
- **No build step.** ES modules + `importmap`, dependencies from CDN. Deploy = static files. (Single-file is no longer a requirement, but ease of entry is.)
- **No per-frame allocations** — reuse temp objects prefixed with `_` (`_pivot`, `_pos`, `_quat`, ...), as in `locomotion.js`/`grab.js`/`physics.js`.
- **All the knobs live in `src/config.js`** — no behaviour magic numbers anywhere else.
- Imports — **with the `.js` extension** and strictly **relative** (`./...`, not `/...`): browser ESM requires the extension, and an absolute path from the root (`/src/...`) breaks on GitHub Pages under the `/vr_sandbox/` subpath.
- **English only** everywhere committed: code, comments, docs, UI strings and commit messages.

## Gotchas
- A secure context is mandatory for WebXR on the device. `localhost` is fine, a LAN IP over http is not. Modules need an HTTP server (not `file://`).
- The Quest stick is `gamepad.axes[2],[3]`. Axes `[0],[1]` are often the touchpad/empty. `thumb()` falls back to 0/1.
- Turn direction is inverted on some runtimes — flip the sign in the `turnAroundHead(...)` call.
- For movement math use `renderer.xr.getCamera()` (the live world-space head pose, already accounting for `dolly`), **not** `camera`.
- `dolly.position.y` is moved only by the jump channel (right A + gravity); horizontal stick movement stays zeroed on Y.
- Right-controller buttons (xr-standard mapping): A = `buttons[4]`, B = `buttons[5]` (trigger 0, grip 1, stick-press 3). Hand tracking has no gamepad → `button()` returns false, so jump/sprint just no-op.
- **cannon-es: the cylinder runs along the Y axis** (like `CylinderGeometry`) — columns need no extra rotation. `CANNON.Plane` faces +Z, so the floor is rotated `-PI/2` around X.
- **Changing a body's type needs `body.updateMassProperties()`** (DYNAMIC<->KINEMATIC), otherwise `invMass` isn't recomputed and the shape won't fall after a throw.
- A held body is driven by teleport + velocity → it lags at most one frame of motion (imperceptible in VR).
- `eachDynamic` callbacks must not add/remove bodies mid-iteration — `effects` collects swallow targets and removes them after the loop. Effects run before `physics.step` so spawns/removes/impulses land in the same frame.
- The cosmos needs `CAMERA_FAR` (~12000) and near-zero fog; the old dense fog + far=100 would hide everything past ~60 m.
- The menu faces the viewer by copying the XR camera quaternion (no `lookAt`); button planes are `DoubleSide` so the controller ray always registers a hit.
- Controls: left **Y** = scene menu (global, in `main`). Per scene — Cosmic Sandbox: left **X** tool menu, left **grip** tool, right trigger grab; Fractal: left **grip** warp, left **X** morph. Right hand always locomotion/jump/sprint. Hand tracking has no buttons, so menus/tools are controller-only.
- Scenes are cached, not disposed, on switch — their state (spawned shapes, black hole, etc.) survives. The shared `dolly` lives in one scene at a time; the manager re-parents it.
- Don't parent per-scene visuals to the shared `camera`/`dolly` — they'd leak across scenes. The cosmos warp streaks live in their scene and are synced to the camera pose each frame.
- `renderer.shadowMap` is enabled globally (for Megalith Dawn). Other scenes set no `castShadow`, so they pay nothing. Megalith's shadow light + target track the player so the map covers where you are; far giants don't cast (silhouettes only) to save cost.
- `createLocomotion(renderer, dolly, opts)` takes per-scene overrides (`gravity` / `jumpSpeed` / `speed` / `sprintMultiplier`); defaults come from `config.js`.
- Fractal Abyss raymarches every pixel — the heaviest scene. If FPS drops, lower the raymarch/iteration loop counts in `fractalAbyss.js` (they must be GLSL literals) or raise `ABYSS_SCALE`. Do **not** declare `cameraPosition` in the shader — three injects it (and `modelMatrix`/`viewMatrix`/`projectionMatrix`).
- Audio is suspended until a user gesture; `resumeAudio()` runs on `sessionstart` and the first `pointerdown`. Event sounds are gated on `renderer.xr.isPresenting`; drones play once unlocked. Oscillators are one-shot, so `createDrone` rebuilds its nodes on each `start()`.

## Not done yet (see roadmap in PROJECT.md)
Teleport arc, comfort vignette, spawning shapes with the grip button, haptics on grab/hover.
