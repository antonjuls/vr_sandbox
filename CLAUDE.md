# CLAUDE.md — VR Shapes

WebXR sandbox for Meta Quest 3. Three.js + WebXR + cannon-es. **ES modules, no build step.**

## Running
- **Desktop dev:** `python -m http.server 8080` → `http://localhost:8080/`.
  `localhost` is a secure context, so the WebXR Emulator (Chrome extension) works.
  Modules load over HTTP — you **cannot** open `index.html` via `file://` (CORS kills the imports).
- **On Quest:** needs **HTTPS** (secure context). A bare LAN `http://192.168...` won't show the Enter VR button.
  Deploy: **GitHub Pages auto-deploys from the `main` branch** → `https://antonjuls.github.io/vr_sandbox/` (pure static, no build step). Open the URL in the Quest browser → Enter VR.
- No npm/bundler. `three@0.160` and `cannon-es@0.20.0` load via an `importmap` from the jsdelivr CDN.

## Files
- `index.html` — markup, overlay, `importmap` and the entry point `<script type="module" src="./src/main.js">`.
- `src/config.js` — **all the knobs** (movement + physics + simulation step). Change behaviour here.
- `src/scene.js` — the world: lights, floor, columns, stars, grabbable shapes. `buildScene()` → `{ scene, grabbables, columns }`.
- `src/physics.js` — cannon-es wrapper: world, bodies, sync, grabbing. `createPhysics()`.
- `src/controllers.js` — controllers, grips, hands, ray. `setupControllers(renderer, dolly, onStart, onEnd)`.
- `src/grab.js` — ray target picking, highlight, feeding the controller pose into physics. `createGrab(grabbables, physics)`.
- `src/locomotion.js` — movement and turning. `createLocomotion(renderer, dolly)`.
- `src/main.js` — wires everything together plus the render loop.
- `PROJECT.md` — what the project is, its state, the roadmap.

## Architecture
- **`dolly` (THREE.Group) = the player rig.** Children: `camera`, both controllers (`getController`), grips, hands (`getHand`).
  Moving/rotating `dolly` drives the whole player through the world; physical tracking applies on top.
  Works because three.js multiplies the XR camera's worldMatrix by `camera.parent`.
- **Physics — cannon-es (`src/physics.js`).** Every mesh gets a body; the `mesh <-> body` link lives in the `links` array.
  Each frame `step(dt)` runs `world.step(FIXED_STEP, dt, MAX_SUBSTEPS)` and **copies the body transform into the mesh** (the body is the source of truth). Floor — `CANNON.Plane`, columns — static `CANNON.Cylinder`, shapes — `Sphere`/`Box` (box = `Box`, everything else = `Sphere` from the bounding sphere).
- **Grab = kinematic body.** On grab, meshes are **NOT reparented** (there used to be `controller.attach`). On `selectstart` the shape's body becomes `KINEMATIC`, and every frame `grab.updateHeld` feeds the controller's world pose (`matrixWorld.decompose`) into `physics.updateHeld` — the body teleports onto the hand and gets the hand velocity (so it can push others). On `selectend` the body goes `DYNAMIC` again and receives the hand velocity → **throw** (capped by `MAX_THROW`). The same `select` events arrive from a hand pinch.
- **Locomotion (`src/locomotion.js`).** Gamepads via `session.inputSources` by `handedness`. Left stick — move relative to gaze (horizontal). Right — turn (smooth by default, snap behind the `SMOOTH_TURN` flag), rotating around the world-space head position.
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
- Don't touch `dolly.position.y` (no flying) — movement vectors are zeroed on Y.
- **cannon-es: the cylinder runs along the Y axis** (like `CylinderGeometry`) — columns need no extra rotation. `CANNON.Plane` faces +Z, so the floor is rotated `-PI/2` around X.
- **Changing a body's type needs `body.updateMassProperties()`** (DYNAMIC<->KINEMATIC), otherwise `invMass` isn't recomputed and the shape won't fall after a throw.
- A held body is driven by teleport + velocity → it lags at most one frame of motion (imperceptible in VR).

## Not done yet (see roadmap in PROJECT.md)
Teleport arc, comfort vignette, spawning shapes with the grip button, haptics on grab/hover.
