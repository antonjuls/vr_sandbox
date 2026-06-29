// All project "knobs". Want to change behaviour — do it here.

// ====== MOVEMENT ======
export const SPEED = 2.4; // m/s, walking speed
export const SMOOTH_TURN = true; // true → smooth turn, false → snap turn per click
export const SNAP_ANGLE = Math.PI / 4; // 45° per click (snap mode)
export const SMOOTH_SPEED = 2.2; // rad/s for smooth turn
export const DEADZONE = 0.2; // stick dead zone
export const SPRINT_MULTIPLIER = 2.2; // right B held → walking speed multiplier (sprint)
export const JUMP_SPEED = 3.2; // m/s, initial upward velocity on jump (right A); reuses GRAVITY for the fall

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

// ====== EFFECTS (left hand) ======
// Black hole (left Y): spawns ahead of your gaze, pulls/swirls shapes, swallows them at the horizon.
export const BH_DISTANCE = 2.6; // m, how far ahead of the gaze it appears
export const BH_PULL = 26; // pull strength (acceleration, falls off as 1/r²)
export const BH_MAX_ACCEL = 60; // m/s², cap so close shapes don't explode
export const BH_SWIRL = 7; // tangential swirl (makes shapes orbit instead of dropping straight in)
export const BH_RADIUS = 0.32; // m, visual core radius
export const BH_HORIZON = 0.5; // m, shapes closer than this get swallowed
export const BH_REACH = 16; // m, no pull beyond this
export const SWIRL_PARTICLES = 340; // orbiting particles around the core

// Force blast (left grip): shoves nearby shapes away from you.
export const BLAST_RADIUS = 4.5; // m, affected range
export const BLAST_IMPULSE = 9; // push strength at the centre

// Shape spawner (left X): launches a fresh shape; recycles the oldest past the cap.
export const MAX_SHAPES = 26; // total shape cap
export const SPAWN_SPEED = 3.5; // m/s, launch speed out of the gaze

// Particle burst pool (swallows / blasts / spawns).
export const PARTICLES = 600; // pool size
