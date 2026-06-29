// All project "knobs". Want to change behaviour — do it here.

// ====== MOVEMENT ======
export const SPEED = 2.4; // m/s, walking speed
export const SMOOTH_TURN = true; // true → smooth turn, false → snap turn per click
export const SNAP_ANGLE = Math.PI / 4; // 45° per click (snap mode)
export const SMOOTH_SPEED = 2.2; // rad/s for smooth turn
export const DEADZONE = 0.2; // stick dead zone
export const SPRINT_MULTIPLIER = 2.2; // right B held → walking speed multiplier (sprint)
export const JUMP_SPEED = 3.2; // m/s, initial upward velocity on jump (right A)

// ====== PHYSICS (cannon-es) ======
export const GRAVITY = 9.81; // m/s², free-fall acceleration (Earth-like)
export const RESTITUTION = 0.4; // bounciness (0 — no bounce, 1 — perfect bounce)
export const FRICTION = 0.4; // friction between surfaces
export const LINEAR_DAMPING = 0.05; // linear velocity damping (gentle)
export const ANGULAR_DAMPING = 0.1; // angular velocity damping
export const THROW_SCALE = 1.0; // throw velocity multiplier
export const MAX_THROW = 10; // m/s, throw speed cap (guards against tracking spikes)
export const BODY_MASS = 0.5; // kg, mass of grabbable shapes

// ====== SIMULATION STEP ======
export const FIXED_STEP = 1 / 72; // s, fixed physics step (matches Quest 72 Hz)
export const MAX_SUBSTEPS = 4; // substeps to catch up on FPS drops

// ====== COSMOS / WARP FLIGHT ======
export const CAMERA_FAR = 12000; // far plane — so the giant distant bodies are visible
export const WARP_ACCEL = 220; // m/s², warp speed ramp while thrusting
export const WARP_MAX = 380; // m/s, top warp speed (very fast flight toward gaze)
export const WARP_DECAY = 2.5; // 1/s, warp speed bleed-off when released
export const WARP_FLOAT_Y = 3; // above this height the player floats (no ground gravity)
export const STREAKS = 320; // hyperspace streak count

// ====== TOOLS / EFFECTS (menu-selected, used with left grip) ======
// Black hole: pulls / swirls / swallows shapes.
export const BH_DISTANCE = 2.6; // m, how far ahead of gaze it appears
export const BH_PULL = 26; // pull strength (acceleration, falls off as 1/r²)
export const BH_MAX_ACCEL = 60; // m/s², cap so close shapes don't explode
export const BH_SWIRL = 7; // tangential swirl (shapes orbit instead of dropping straight in)
export const BH_RADIUS = 0.32; // m, visual core radius
export const BH_HORIZON = 0.5; // m, shapes closer than this get swallowed
export const BH_REACH = 16; // m, no pull beyond this
export const SWIRL_PARTICLES = 340; // orbiting particles around the core

// Supernova: a powerful outward blast.
export const SUPERNOVA_RADIUS = 9; // m, affected range
export const SUPERNOVA_IMPULSE = 20; // push strength at the centre

// Star Forge: spawn a drifting mini-sun.
export const STAR_RADIUS = 0.9; // m
export const STAR_DRIFT = 1.2; // m/s drift away from you
export const STAR_MAX = 5; // cap on spawned stars

// Drop Shape: launch a grabbable shape; recycles the oldest past the cap.
export const MAX_SHAPES = 26; // total shape cap
export const SPAWN_SPEED = 3.5; // m/s, launch speed along gaze

// Particle burst pool (swallows / novae / spawns).
export const PARTICLES = 600; // pool size

// ====== FRACTAL INFINITY scene ======
export const FRACTAL_DEPTH = 3; // Menger sponge recursion depth (20^depth cubes; 3 → 8000)
export const FRACTAL_SIZE = 140; // size of the central sponge

// ====== MEGALITH DAWN scene ======
export const MOON_GRAVITY = 2.4; // m/s², low gravity for floaty, long jumps
export const MOON_JUMP = 4.6; // m/s, jump launch velocity
export const MOON_SPEED = 3.0; // m/s, walking speed on the planet
export const SPRINT_10X = 10; // B held → 10x movement
export const GIANTS = 84; // scattered geometric giants (mixed sizes)
export const TITANS = 14; // colossal far-horizon giants (megalophobia)
export const FOREST = 28; // cluster of towering monoliths ("forest of giants")
