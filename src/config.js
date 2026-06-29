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

// ====== FLIGHT (shared by non-grounded scenes) ======
export const FLY_SPEED = 8; // m/s, left-stick free-fly speed

// ====== FRACTAL ABYSS scene (raymarched shader) ======
export const ABYSS_REP = 10; // domain-repetition cell size (smaller = denser)
export const ABYSS_SCALE = 0.26; // fractal scale within a cell

// ====== CRIMSON VOID scene ======
export const VOID_MONOLITHS = 52; // breathing dark giants in the red murk

// ====== HYPERZOOM scene (raymarched infinite zoom) ======
export const HYPERZOOM_REP = 9; // domain-repetition cell size
export const HYPERZOOM_SCALE = 0.28; // fractal scale within a cell
export const HYPERZOOM_RATE = 0.12; // base zoom speed (always falling inward)
export const HYPERZOOM_BOOST = 0.9; // extra zoom while warping (left grip)

// ====== THE THRESHOLD CATHEDRAL scene ======
// A grounded liminal-horror promenade: you walk a single axis through seven zones
// toward a colossal door. All the dread knobs live here. Distances are in metres along
// -Z; the giant door sits at the far end and is faintly visible from the start.
export const CATHEDRAL = {
  // movement — you run by default; B is near-warp (~100 km/h) to cross the vast halls
  move: { speed: 4.8, sprint: 6.0, gravity: 9.81, jump: 2.8 }, // 4.8 * 6 ≈ 28.8 m/s ≈ 104 km/h

  // capsule collision against the architecture (a simple in-scene resolver, not cannon)
  collide: { radius: 0.4, passes: 2 },

  // global murk. One FogExp2; its density eases toward the active zone's target.
  // Lighter than the first pass so you can actually see the space.
  fog: {
    color: 0x12161d,
    lerp: 0.35, // density easing per second
    arrival: 0.003,
    corridor: 0.0042,
    stairwell: 0.0034,
    balcony: 0.0012, // the void opens up — see far
    archive: 0.0052, // closes in around you
    doorField: 0.0036,
    cathedral: 0.0026,
  },

  // non-Euclidean distortion (never moves the camera — only far geometry / fog)
  scale: {
    recede: 26, // metres the corridor's far end retreats as you approach
    recedeRate: 0.55, // how strongly approach drives the retreat
    grow: 0.5, // extra scale the corridor end swells to (0.5 → up to 1.5x)
    lerp: 0.6, // distortion easing per second
  },

  // light: a soft ambient + a distant warm "evening sun" (lights the far giants), plus
  // cold fluorescent lamps for accents/flicker.
  light: {
    cold: 0xcfe0f0, // fluorescent white-blue
    emergency: 0xff3020, // rare emergency red
    ambient: 0x3a4452, // base fill colour (lifts the darkest values)
    ambientI: 1.0, // ambient intensity
    hemi: 1.45, // hemisphere intensity
    sun: 0xffb070, // warm low sun, almost sunset
    sunI: 1.4, // directional sun intensity (reaches the far giants)
    lampIntensity: 70, // point-light intensity
    lampDistance: 150, // point-light range
    lampDecay: 1.0, // gentle falloff so halls actually light up
    flicker: 0.4, // 0..1 depth of the flicker (subtler so it stays readable)
    nearThreshold: 7, // metres: lamps stutter when you near a doorway
  },

  // hand flashlight (left trigger toggles it). decay 0 + no range cutoff → it reaches and
  // lights even the most distant giants in its beam.
  flashlight: { color: 0xfff4e2, intensity: 8, angle: 0.34, penumbra: 0.5, decay: 0 },

  // experimental portals: seamless teleport between two doorways + a live "window"
  // that renders the destination onto the portal surface. roomAt is the hidden room.
  portal: { window: true, rtSize: 1280, renderRange: 70, fov: 75, roomAt: [3000, 0, 3000] },

  // the Infinite Corridor
  corridor: { length: 220, width: 15, height: 26, bays: 20 },

  // distant colossal silhouettes — barely there, gone when you look straight at them
  entity: {
    horizon: 2, // silhouettes on the far edge of perception
    voidCrossers: 2, // enormous shapes drifting through the balcony void
    distance: 1700,
    height: 520,
    visible: 0.45, // opacity when unobserved
    stareDot: 0.99, // look closer than this (view·dir) → it fades out
    fade: 1.8, // opacity ease per second
    drift: 5, // m/s lateral drift
  },

  // threshold "events" when you cross from one zone to the next
  threshold: { muffle: 0.28, muffleHold: 0.7, muffleRamp: 0.3 },

  // the Door Field — thousands of freestanding doors at impossible scales
  doorField: {
    instanced: 260, // dressing doors (instanced, static)
    spread: 900,
    special: 6, // hand-built doors with uncanny interiors
    nudge: 0.05, // radians a special door turns while you aren't looking
  },

  // the audioscape (LiminalAudioSystem). Main owns the sub-bass drone; this adds layers.
  audio: {
    buzz: { freq: 118, type: "sawtooth", voices: 2, detune: 3, cutoff: 1500, gain: 0.014, lfoRate: 8, lfoDepth: 0.05 },
    wind: { gain: 0.06, cutoff: 200 }, // low wind in impossible interiors
    dripEvery: [3, 12], // s — water from very high above
    groanEvery: [10, 24], // s — distant metal / concrete
    stepEvery: [7, 18], // s — footsteps that may not be yours
    impactEvery: [26, 60], // s — very rare, very far, very deep
    heartbeat: 1.15, // s — the slow pulse from behind the final door
  },
};

// ====== LUMEN DRIFT scene (infinite luminous swarm you fly through) ======
// All motion is computed in the vertex shader from uTime, and the swarm is wrapped around
// the camera (an infinite field with no per-frame CPU work). Knobs:
export const LUMEN = {
  count: 48000, // motes (GPU points). Lower if fill-rate drops on device.
  cell: 1200, // camera-relative wrap cell (the swarm always surrounds you)
  size: 1.6, // base point size
  sizeScale: 620, // perspective size scale (px ≈ size·scale / distance)
  drift: 7, // ambient flow speed when you're still
  amp1: 60, // large-scale swirl amplitude
  amp2: 26, // fine swirl amplitude
  flySpeed: 50, // left-stick fly speed (B sprints ×4; left grip warps far faster)
  orbs: 6, // giant glowing landmark orbs drifting by
  orbCell: 2600, // their wrap cell
  streaks: 600, // hyperspace streaks that ignite with speed
  streakLen: 70, // streak length at full warp
  streakRange: 700, // depth the streaks occupy around you
};
