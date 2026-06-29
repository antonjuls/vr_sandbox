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
