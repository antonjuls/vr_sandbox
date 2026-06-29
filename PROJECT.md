# PROJECT.md — VR Shapes

## What it is
A VR sandbox for Meta Quest 3: geometric solids with real physics (gravity, bouncing, collisions) that you can grab, rearrange and throw, with free movement around the scene. The goal is a lightweight, instantly browser-openable playground (no Unity / store / APK) and a base for further VR experiments.

## Stack and principles
- Three.js `0.160` (WebXR) + cannon-es `0.20.0` (physics), both via a CDN `importmap`.
- **ES modules, no build step.** Deploy — **GitHub Pages, auto from the `main` branch** (pure static, no build step); this is the live channel to Quest.
- Priorities: ease of entry and instant deploy > everything else. Modular for readability, but no toolchain until we have to.

## Structure
- `index.html` — markup + `importmap` + entry point.
- `src/config.js` — all settings (movement, physics, simulation step).
- `src/config.js` · `src/scene.js` · `src/physics.js` · `src/controllers.js` · `src/grab.js` · `src/locomotion.js` · `src/effects.js` · `src/input.js` · `src/main.js` — subsystems (see CLAUDE.md → "Files").

## Current state (working)
- Scene: 5 Platonic solids + a torus knot, a grid floor, landmark columns, stars, coloured lights.
- **Physics (cannon-es):** shapes fall under gravity (9.81 m/s²), bounce, **collide with each other and with the columns**, settle and sleep. The box lies flat (Box collider), everything else uses a sphere collider.
- **Grab and throw** with a ray — both controllers **and** hands (pinch). A held shape is a kinematic body that follows the hand and pushes others; releasing = a throw with the hand velocity.
- Movement: left stick — move relative to gaze; right stick — turn (smooth by default, snap behind the `SMOOTH_TURN` flag). Right **A** — jump, right **B** — sprint (hold to move fast).
- **Powers (left hand):** left **X** spawns shapes; left **Y** toggles a black hole that pulls, swirls and swallows shapes (with a particle vortex + accretion disk); left **grip** fires a force blast. Pooled particle bursts for swallows / blasts / spawns.
- Hand tracking (sphere model), Quest controller models, pointer ray.
- Desktop mode with OrbitControls for quick checks without a headset.

## Key decisions
- **The `dolly` rig**: camera, controllers and hands are children of one group; locomotion = transforming the group. Physical tracking lives "inside" the virtual movement.
- **Physics via a dedicated engine (cannon-es), not hand-rolled**: we need collisions between shapes / with columns, stacking and correct resting. The body is the source of truth, the mesh mirrors it.
- **Grab without reparenting**: the shape's body becomes kinematic and follows the controller; on release it goes dynamic again + hand velocity (throw). Keeps the visual and the collider in sync.
- **Gamepad via `inputSources`/`handedness`**, not by index — more robust to hand layout.
- **Modules + importmap, no build**: kept the instant deploy, gained readability and extensibility.

## Roadmap (descending priority)
1. **Comfort locomotion**: a comfort vignette at the edges during smooth movement (anti-nausea). Cheap, big impact on feel.
2. **Teleport arc** on the left grip as an alternative to the stick.
3. **Haptics** on grab/hover/impact (`gamepad.hapticActuators.pulse`).
4. **More powers & tuning**: spawn / black hole / blast are in (left hand) — next could be portals, time-slow or magnet hands; plus tuning their `config.js` knobs.
5. **Physics polish**: tune mass/friction/restitution in `config.js`, an audio click on grab/impact, exact colliders (convex hulls instead of spheres).
6. **Polish**: tune speeds, a skybox gradient.

## Open questions
- Snap vs smooth turn as the default — currently smooth; keep it or add a runtime toggle in VR.
- Do we need a scene manager (several "rooms") or stay a single playground.
- When (and whether) to move to Vite + npm — if we hit the limits of the importmap approach or want TypeScript/HMR. **Note:** a build step would break the current branch-based Pages auto-deploy — it would need GitHub Actions.

## Manual test checklist (on device)
- Enter VR appears (means the secure context is OK).
- Movement in all four directions, turning both ways without jerks/inversion.
- Right A jumps from the ground and arcs back down; right B held sprints.
- Grab/release with a controller; the same with hands after putting the controllers down.
- Shapes fall and settle on the floor; the box lies flat, doesn't hover.
- A thrown shape flies in an arc, **collides with other shapes and columns**, settles and doesn't jitter.
- You can build a stack of several shapes.
- Left X spawns shapes; left Y opens a black hole that swirls shapes in and swallows them; left grip blasts shapes away.
- A released (placed) shape stays put when you move away.
