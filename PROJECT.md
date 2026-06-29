# PROJECT.md — VR Shapes

## What it is
A VR playground for Meta Quest 3 built as a set of **selectable scene-experiments** (switch in-headset via the scene menu, left Y). Each scene is its own world with its own rules — a grounded physics sandbox inside a giant cosmos, a fly-through fractal, and more to come. The goal is a lightweight, instantly browser-openable space (no Unity / store / APK) and a base for wild VR experiments.

## Stack and principles
- Three.js `0.160` (WebXR) + cannon-es `0.20.0` (physics), both via a CDN `importmap`.
- **ES modules, no build step.** Deploy — **GitHub Pages, auto from the `main` branch** (pure static, no build step); this is the live channel to Quest.
- Priorities: ease of entry and instant deploy > everything else. Modular for readability, but no toolchain until we have to.

## Structure
- `index.html` — markup + `importmap` + entry point.
- `src/config.js` — all settings (movement, physics, simulation step).
- `src/config.js` · `src/scene.js` · `src/physics.js` · `src/controllers.js` · `src/grab.js` · `src/locomotion.js` · `src/cosmos.js` · `src/flight.js` · `src/menu.js` · `src/effects.js` · `src/input.js` · `src/sceneManager.js` · `src/scenes/*` · `src/main.js` — subsystems (see CLAUDE.md → "Files").

## Current state (working)
- **Scenes (switch with left Y):** **Cosmic Sandbox**, **Fractal Infinity**, **Megalith Dawn**, **Fractal Abyss**, **Vortex Storm**, **Clockwork Titans**, **Crimson Void**, **Hyperzoom**. Each keeps its state when you switch away. Flight scenes share one movement scheme (right stick turn, left stick fly, grip warp).

### Cosmic Sandbox
- Scene: 5 Platonic solids + a torus knot, a grid floor, landmark columns, stars, coloured lights.
- **Physics (cannon-es):** shapes fall under gravity (9.81 m/s²), bounce, **collide with each other and with the columns**, settle and sleep. The box lies flat (Box collider), everything else uses a sphere collider.
- **Grab and throw** with a ray — both controllers **and** hands (pinch). A held shape is a kinematic body that follows the hand and pushes others; releasing = a throw with the hand velocity.
- Movement: left stick — move relative to gaze; right stick — turn (smooth by default, snap behind the `SMOOTH_TURN` flag). Right **A** — jump, right **B** — sprint (hold to move fast).
- **Cosmos:** a gigantic backdrop — colossal ringed gas giant, blazing sun, supermassive black hole with a vast accretion disk, a spiral galaxy and deep starfields — built for overwhelming scale.
- **Warp flight:** the Warp tool flies you toward your gaze at high speed with hyperspace streaks; lift off the ground and cross space toward the giant bodies.
- **Tool menu (left X):** a floating panel; point the right ray + trigger to pick the tool used by **left grip** — Warp, Black Hole, Supernova, Star Forge, Drop Shape. Pooled particle bursts throughout.
- Hand tracking (sphere model), Quest controller models, pointer ray.
- Desktop mode with OrbitControls for quick checks without a headset.

### Fractal Infinity
- A colossal Menger sponge (`InstancedMesh`) with self-similar nested copies and a field of giant looming ones; deep stars; constant hue drift.
- Left grip warps you through the tunnels; left X morphs it (wireframe / hue / spin). No physics, no floor.

### Megalith Dawn
- An ordinary planet plain at sunrise: normal walking, Moon-like gravity (long floaty jumps), **B = 10x sprint**, a slow-rising sun with long shadows and warm haze.
- The plain is strewn with random geometric forms — standing and floating, tiny to colossal — including a forest of towering monoliths and giants looming on the horizon (megalophobia).

### Fractal Abyss
- A genuinely infinite 3D fractal raymarched in a fragment shader (folded Sierpinski / KIFS, domain-repeated through space). Fly through it forever; it slowly morphs. The heaviest scene (per-pixel raymarch) — tunable.

### Vortex Storm
- Thousands of shards swirling around a glowing core in concentric, differentially-sheared rings; constant hue drift. Fly through the churn.

### Clockwork Titans
- Colossal nested rings and cog-wheels turning on their own axes like a gyroscopic orrery, in warm dramatic light — mechanical megalophobia.

### Crimson Void
- A blood-red murk where colossal dark monoliths loom out of the fog and slowly breathe (scale-pulse), a distant heart throbs in a double-thump rhythm that drives the light, and embers drift through the haze. Pure dread — fly through it.

### Hyperzoom
- A raymarched fractal that magnifies forever: space is scaled by a self-similar x2 zoom that loops seamlessly, so you keep falling inward into endless detail. Rainbow palette; warp (left grip) dives faster.

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
4. **More scenes & powers**: scenes are now selectable (Cosmic Sandbox, Fractal Infinity) — next scene-experiments could be a raymarched Mandelbulb, particle galaxies, an ocean of cubes; plus more tools (portals, time-slow, magnet hands) and tuning `config.js`.
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
- Left X opens the tool menu; pointing the right ray + trigger selects a tool; left grip uses it.
- Warp (grip) flies toward gaze; you can leave the ground and approach the giant planet / sun / black hole; releasing decelerates.
- Supernova flings shapes; Star Forge spawns a drifting glowing star; Black Hole swirls shapes in and swallows them.
- A released (placed) shape stays put when you move away.
- Left Y opens the scene menu; selecting switches worlds and the previous scene keeps its state.
- Fractal Infinity: left grip flies through the sponge; left X morphs it (wireframe / hue / spin).
- Megalith Dawn: low-gravity long jumps; B sprints ~10x; the sun rises and shadows shift; giant forms loom (some colossal on the horizon).
- Flight scenes (Fractal Infinity / Abyss / Vortex Storm / Clockwork Titans): right stick turns, left stick flies, left grip warps — identical across all of them.
- Fractal Abyss renders an infinite raymarched fractal; Vortex Storm churns; Clockwork Titans turn.
- Crimson Void: monoliths loom from red fog and breathe; the heart throbs and the light pulses with it.
- Hyperzoom: the rainbow fractal magnifies endlessly (no visible jump on the loop); warp dives faster; right stick steers.
