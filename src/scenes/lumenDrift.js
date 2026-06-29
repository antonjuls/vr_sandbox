import * as THREE from "three";
import { createFlightControls } from "../flightControls.js";
import { LUMEN } from "../config.js";

// Scene — "Lumen Drift": an infinite, living tide of luminous motes you fly through. All
// motion is computed in the vertex shader from uTime and wrapped around the camera, so the
// field is endless with no per-frame CPU work — it stays smooth even at full warp. Layers:
// a slowly shifting nebula sky, ~48k iridescent motes flowing along a curl field, giant
// glowing orbs drifting past as landmarks, and hyperspace streaks that ignite with speed.
// Flight is the shared scheme (right stick turn, left stick fly, B sprint, left grip warp).

const PAL = "vec3 palette(float t){ return 0.5 + 0.5*cos(6.28318*(vec3(0.0,0.33,0.67)+t)); }";

const SWARM_VERT = /* glsl */ `
  precision highp float;
  attribute float aPhase;
  attribute float aHue;
  attribute float aSpeed;
  uniform float uTime, uCell, uWarp, uSize, uScale, uDrift, uAmp1, uAmp2;
  varying vec3 vCol;
  varying float vAlpha;
  ${PAL}
  vec3 flow(vec3 p, float t){
    vec3 a = vec3(sin(p.y*0.012 + t), sin(p.z*0.012 + t*1.1), sin(p.x*0.012 + t*0.9));
    vec3 b = vec3(sin(p.z*0.0055 - t*0.7), sin(p.x*0.0055 + t*0.6), sin(p.y*0.0055 - t*0.8));
    return a*uAmp1 + b*uAmp2;
  }
  void main(){
    float t = uTime;
    vec3 drift = normalize(vec3(0.22, 0.12, -1.0));
    vec3 base = position + drift * (t * (0.5 + aSpeed) * uDrift);
    vec3 world = base + flow(base, t*0.3 + aPhase*6.2831);
    vec3 rel = mod(world - cameraPosition + 0.5*uCell, uCell) - 0.5*uCell; // wrap around the eye
    vec3 pos = cameraPosition + rel;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float dist = length(rel) / (0.5*uCell);
    vAlpha = smoothstep(1.0, 0.5, dist);                 // fade at the wrap boundary
    float tw = 0.55 + 0.45*sin(t*2.0 + aPhase*6.2831);   // twinkle
    vCol = palette(aHue + t*0.03 + dist*0.12) * (0.75 + 0.7*uWarp) * (0.55 + 0.6*tw);
    gl_Position = projectionMatrix * mv;
    float ps = uSize * (uScale / max(1.0, -mv.z)) * (0.5 + 0.7*tw) * (1.0 + uWarp*0.9);
    gl_PointSize = clamp(ps, 0.0, 42.0);
  }
`;

const SWARM_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vCol;
  varying float vAlpha;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vCol, a);
  }
`;

const STREAK_VERT = /* glsl */ `
  precision highp float;
  attribute float aSide;
  attribute float aRand;
  uniform float uTime, uWarp, uLen, uRange;
  varying float vA;
  void main(){
    float z = mod(position.z + uTime*(40.0 + aRand*80.0), uRange) - uRange*0.5;
    vec3 head = vec3(position.x, position.y, z);
    float len = uLen * (0.08 + uWarp*1.5);
    vec3 p = head + vec3(0.0, 0.0, aSide*len);   // stretch toward +Z (behind you)
    vA = smoothstep(0.05, 0.45, uWarp) * (1.0 - aSide*0.2);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const STREAK_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vA;
  void main(){
    if (vA <= 0.002) discard;
    gl_FragColor = vec4(uColor * vA, vA);
  }
`;

const BACK_VERT = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACK_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform float uTime;
  ${PAL}
  void main(){
    vec3 d = normalize(vDir);
    float t = uTime * 0.02;
    float n = sin(d.x*3.0 + t) * sin(d.y*2.0 - t*0.8) * sin(d.z*2.5 + t*0.6);
    n = 0.5 + 0.5*n;
    vec3 col = palette(0.6 + n*0.5 + t) * (0.05 + 0.12*n); // dark nebula bands
    gl_FragColor = vec4(col, 1.0);
  }
`;

const palette = (t) =>
  new THREE.Color(
    0.5 + 0.5 * Math.cos(6.28318 * (0.0 + t)),
    0.5 + 0.5 * Math.cos(6.28318 * (0.33 + t)),
    0.5 + 0.5 * Math.cos(6.28318 * (0.67 + t)),
  );

export function createLumenDrift(ctx) {
  const C = LUMEN;
  const { renderer, camera, dolly } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060c);

  // ---- nebula backdrop (always around you) ----
  const backMat = new THREE.ShaderMaterial({
    vertexShader: BACK_VERT,
    fragmentShader: BACK_FRAG,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const backdrop = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 24), backMat);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  // ---- the swarm (GPU-animated, camera-relative infinite wrap) ----
  const n = C.count;
  const seeds = new Float32Array(n * 3);
  const aPhase = new Float32Array(n);
  const aHue = new Float32Array(n);
  const aSpeed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    seeds[i * 3] = Math.random() * C.cell;
    seeds[i * 3 + 1] = Math.random() * C.cell;
    seeds[i * 3 + 2] = Math.random() * C.cell;
    aPhase[i] = Math.random();
    aHue[i] = Math.random();
    aSpeed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
  g.setAttribute("aPhase", new THREE.BufferAttribute(aPhase, 1));
  g.setAttribute("aHue", new THREE.BufferAttribute(aHue, 1));
  g.setAttribute("aSpeed", new THREE.BufferAttribute(aSpeed, 1));
  const swarmMat = new THREE.ShaderMaterial({
    vertexShader: SWARM_VERT,
    fragmentShader: SWARM_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCell: { value: C.cell },
      uWarp: { value: 0 },
      uSize: { value: C.size },
      uScale: { value: C.sizeScale },
      uDrift: { value: C.drift },
      uAmp1: { value: C.amp1 },
      uAmp2: { value: C.amp2 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const swarm = new THREE.Points(g, swarmMat);
  swarm.frustumCulled = false;
  scene.add(swarm);

  // ---- hyperspace streaks (view-space, ignite with speed) ----
  const ns = C.streaks;
  const spos = new Float32Array(ns * 2 * 3);
  const aSide = new Float32Array(ns * 2);
  const aRand = new Float32Array(ns * 2);
  for (let i = 0; i < ns; i++) {
    const x = (Math.random() - 0.5) * 90;
    const y = (Math.random() - 0.5) * 90;
    const z = Math.random() * C.streakRange;
    const r = Math.random();
    for (let k = 0; k < 2; k++) {
      const idx = i * 2 + k;
      spos[idx * 3] = x;
      spos[idx * 3 + 1] = y;
      spos[idx * 3 + 2] = z;
      aSide[idx] = k;
      aRand[idx] = r;
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(spos, 3));
  sg.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
  sg.setAttribute("aRand", new THREE.BufferAttribute(aRand, 1));
  const streakMat = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uWarp: { value: 0 },
      uLen: { value: C.streakLen },
      uRange: { value: C.streakRange },
      uColor: { value: new THREE.Color(0xbfe0ff) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const streaks = new THREE.LineSegments(sg, streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---- giant glowing orbs (landmarks; wrap around you) ----
  const orbs = [];
  for (let i = 0; i < C.orbs; i++) {
    const grp = new THREE.Group();
    const shell = (r, o) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false }),
      );
      grp.add(m);
      return m.material;
    };
    const mats = [shell(14, 0.9), shell(40, 0.28), shell(95, 0.1)];
    grp.frustumCulled = false;
    scene.add(grp);
    orbs.push({
      grp,
      mats,
      baseOp: [0.9, 0.28, 0.1],
      off: new THREE.Vector3((Math.random() - 0.5) * C.orbCell, (Math.random() - 0.5) * C.orbCell, (Math.random() - 0.5) * C.orbCell),
      dir: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      hue: Math.random(),
      hueRate: 0.02 + Math.random() * 0.05,
      dspeed: 4 + Math.random() * 8,
    });
  }

  const controls = createFlightControls(renderer, dolly, { flySpeed: C.flySpeed });
  const _cam = new THREE.Vector3();
  const _camQ = new THREE.Quaternion();
  const _prev = new THREE.Vector3();
  let t = 0;
  let warpVis = 0;
  let primed = false;

  function update(dt) {
    controls.update(dt);
    t += dt;

    const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    _cam.setFromMatrixPosition(xrCam.matrixWorld);
    _camQ.setFromRotationMatrix(xrCam.matrixWorld);

    // measured rig speed → warp visual (works for stick / sprint / grip warp alike)
    const spd = primed ? _cam.distanceTo(_prev) / Math.max(dt, 1e-4) : 0;
    _prev.copy(_cam);
    primed = true;
    warpVis += (Math.min(spd / 160, 1.4) - warpVis) * Math.min(1, dt * 4);

    backMat.uniforms.uTime.value = t;
    swarmMat.uniforms.uTime.value = t;
    swarmMat.uniforms.uWarp.value = warpVis;
    streakMat.uniforms.uTime.value = t;
    streakMat.uniforms.uWarp.value = warpVis;

    backdrop.position.copy(_cam);
    streaks.position.copy(_cam);
    streaks.quaternion.copy(_camQ);

    const half = 0.5 * C.orbCell;
    for (const o of orbs) {
      o.off.addScaledVector(o.dir, o.dspeed * dt);
      const rx = (((o.off.x - _cam.x + half) % C.orbCell) + C.orbCell) % C.orbCell - half;
      const ry = (((o.off.y - _cam.y + half) % C.orbCell) + C.orbCell) % C.orbCell - half;
      const rz = (((o.off.z - _cam.z + half) % C.orbCell) + C.orbCell) % C.orbCell - half;
      o.grp.position.set(_cam.x + rx, _cam.y + ry, _cam.z + rz);
      const dist = Math.sqrt(rx * rx + ry * ry + rz * rz) / half;
      const fade = THREE.MathUtils.clamp(1 - (dist - 0.6) / 0.4, 0, 1);
      const col = palette(o.hue + t * o.hueRate);
      for (let k = 0; k < 3; k++) {
        o.mats[k].color.copy(col);
        o.mats[k].opacity = o.baseOp[k] * fade;
      }
    }
  }

  function onActivate() {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    controls.reset();
    primed = false;
    warpVis = 0;
  }

  return { name: "Lumen Drift", scene, update, onActivate };
}
