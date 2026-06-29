# PROJECT.md — VR Shapes

## What it is
A VR playground for Meta Quest 3 built as named scene-experiments (switchable in-headset via the scene menu, left Y). The **current focus is a single polished scene — "The Threshold Cathedral"**, a grounded liminal-horror experience; the earlier experiments (a cosmic physics sandbox, fly-through fractals, etc.) are **archived for reference**. The goal is a lightweight, instantly browser-openable space (no Unity / store / APK) and a base for wild VR experiments.

## Stack and principles
- Three.js `0.160` (WebXR) + cannon-es `0.20.0` (physics), both via a CDN `importmap`.
- **ES modules, no build step.** Deploy — **GitHub Pages, auto from the `main` branch** (pure static, no build step); this is the live channel to Quest.
- Priorities: ease of entry and instant deploy > everything else. Modular for readability, but no toolchain until we have to.

## Structure
- `index.html` — markup + `importmap` + entry point.
- `src/config.js` — all settings (movement, physics, simulation step).
- `src/config.js` · `src/scene.js` · `src/physics.js` · `src/controllers.js` · `src/grab.js` · `src/locomotion.js` · `src/cosmos.js` · `src/flight.js` · `src/menu.js` · `src/effects.js` · `src/input.js` · `src/sceneManager.js` · `src/scenes/*` · `src/main.js` — subsystems (see CLAUDE.md → "Files").

## Current state (working)
- **Active scene: The Threshold Cathedral** — a grounded liminal-horror promenade (see below). The earlier experiment scenes are **archived** (commented out in `main.js`, files kept for reference).
- **Audio:** procedural Web Audio — a sub-bass drone + a LiminalAudioSystem of **3D-positional** dread (drips from far above, distant metal groans, footsteps that may not be yours, rare colossal impacts) and the final-door heartbeat. Right stick-press mutes; crossing a threshold briefly muffles. Unlocks on VR entry / first tap.
- **Service worker** (network-first): new builds load on reload, no cache clearing.

### The Threshold Cathedral
A grounded walking-horror promenade: you cross a single −Z axis through seven monumental concrete zones toward a door ~300 m tall that was not built for humans. The fear is architectural — scale, distance, silence, and a space that quietly rearranges when you look away. No monsters, no gore, no jumpscares.

- **Zones (near → far):** Arrival Hall (black-glass floor, the far door already glimmering) · Infinite Corridor (its far end recedes and swells as you approach) · Stairwell of Wrong Angles · Observation Void (a bridge over an abyss with colossal shapes drifting far below) · Breathing Archive (giant shelves that swell like lungs) · Door Field (a plain of freestanding doors at every scale, a few with uncanny interiors) · Final Cathedral (the colossal door, a heartbeat behind it).
- **Systems** (`src/cathedral/*`), each fed the head pose each frame: threshold triggers (per-zone fog, muffle, distortion, door reshuffle on each crossing) · scale distortion · distant entities that vanish when stared at · non-Euclidean doors that move only while off-screen · environmental observation (flicker, swaying chains, creaking slabs, breathing). All of it moves geometry/fog/opacity only — **never the camera** (comfort).
- **Move:** you run by default (left stick), right-stick turn; **hold B to sprint near-warp (~100 km/h)**. A lightweight XZ collision resolver keeps you out of the walls and off the bridge; you can't fall into the void. **Left trigger** toggles a hand flashlight (bright, no falloff — it reaches the far giants). The right ray + trigger pushes on a door (the final one only ever yields a crack).
- **Portals (experimental):** a Door Field doorway is linked to a doorway in a room built far away. Step through and the rig teleports seamlessly; the destination is rendered live onto the portal surface so you can see through first. Toggle the window render with `CATHEDRAL.portal.window`.
- **Light:** a soft ambient + a distant warm "evening sun" (lights the far giants) + cold flickering lamps. Built once by `buildCathedral(scene)` (instancing, shared concrete materials, no shadows) so it runs on a standalone headset. Every knob lives in the `CATHEDRAL` object in `config.js`.

### Archived scenes (reference only)
Cosmic Sandbox · Fractal Infinity · Megalith Dawn · Fractal Abyss · Vortex Storm · Clockwork Titans · Crimson Void · Hyperzoom. Their files remain in `src/scenes/` (the flight scenes share `src/flightControls.js`); re-enable any by uncommenting its import + entries in `main.js`.

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
- You start in the Arrival Hall; the giant door glimmers far down the −Z axis.
- You run by default; turn both ways smoothly; hold B to sprint very fast (~100 km/h).
- Left trigger toggles the hand flashlight; aim it at a far giant and it lights up in the beam.
- The murk thickens/thins as you cross between zones, and the sound briefly muffles on each crossing.
- The Infinite Corridor's far doorway recedes and grows as you approach it.
- Distant silhouettes are faintly visible at the edges; look straight at one and it fades away.
- Observation Void: a narrow bridge over an abyss; tiny lights and colossal shapes drift far below.
- The Breathing Archive's shelves swell and contract slowly.
- Door Field: doors you aren't looking at turn slightly / change; the special doors show uncanny interiors.
- Walls and shelves are solid (you can't walk through them); the void bridge is the only way across.
- A portal doorway shows another place on its surface; walking through it teleports you into a room that shouldn't fit, and back.
- Final Cathedral: the door is ~300 m tall; a heartbeat (boom + light pulse) grows as you near it; the right trigger forces it open only a crack.
- Lights flicker (worse near doorways); chains sway; suspended slabs creak overhead.
- Audio is spatial — drips from above, groans and footsteps around you. Right stick-press mutes.
- Left Y opens the scene menu (only The Threshold Cathedral is listed).
- After a deploy, a reload picks up the new build (service worker) — no cache clearing.
