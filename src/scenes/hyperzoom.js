import * as THREE from "three";
import { createFlightControls } from "../flightControls.js";
import { HYPERZOOM_REP, HYPERZOOM_SCALE, HYPERZOOM_RATE, HYPERZOOM_BOOST } from "../config.js";

// Scene — "Hyperzoom": a raymarched fractal that continuously magnifies. Space is scaled
// by exp2(fract(uZoom)); because the KIFS fractal is self-similar under x2, the scale wraps
// 2->1 seamlessly, so it appears to zoom in forever. The zoom always runs (you fall inward)
// and warp (left grip) accelerates it; right stick steers what fills your view. Rainbow palette.
const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform float uTime;
  uniform float uZoom;
  uniform float uRep;
  uniform float uScale;

  float de(vec3 z, out float trap) {
    float scale = 2.0;
    float c = 1.0 + 0.1 * sin(uTime * 0.1);
    trap = 1e9;
    for (int n = 0; n < 11; n++) {
      if (z.x + z.y < 0.0) z.xy = -z.yx;
      if (z.x + z.z < 0.0) z.xz = -z.zx;
      if (z.y + z.z < 0.0) z.zy = -z.yz;
      z = z * scale - vec3(c) * (scale - 1.0);
      trap = min(trap, dot(z, z));
    }
    return length(z) * pow(scale, -11.0);
  }

  // iq cosine palette → vivid rainbow
  vec3 palette(float t) {
    return 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + t));
  }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - cameraPosition);
    float s = exp2(fract(uZoom)); // 1..2, seamless infinite zoom
    float t = 0.0;
    float trap = 0.0;
    bool hit = false;
    float tt = 0.0;
    int sN = 0;
    for (int i = 0; i < 72; i++) {
      vec3 p = (ro + rd * t) * s;
      vec3 q = mod(p + 0.5 * uRep, uRep) - 0.5 * uRep;
      float tr;
      float d = de(q * uScale, tr) / (uScale * s);
      trap = tr;
      if (d < 0.0012 * t + 0.0008) { hit = true; tt = t; sN = i; break; }
      t += d;
      if (t > 200.0) break;
    }
    vec3 col;
    if (hit) {
      float it = float(sN) / 72.0;
      vec3 pal = palette(trap * 0.5 + uTime * 0.04 + uZoom * 0.08);
      float fade = 1.0 / (1.0 + tt * 0.02);
      col = pal * (0.4 + 0.6 * (1.0 - it)) * fade + pal * 0.25;
    } else {
      col = vec3(0.02, 0.0, 0.05);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createHyperzoom(ctx) {
  const { renderer, camera, dolly } = ctx;
  const scene = new THREE.Scene();

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uZoom: { value: 0 },
      uRep: { value: HYPERZOOM_REP },
      uScale: { value: HYPERZOOM_SCALE },
    },
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 24), mat);
  shell.frustumCulled = false;
  scene.add(shell);

  const controls = createFlightControls(renderer, dolly, { flySpeed: 8 });
  const _p = new THREE.Vector3();

  function update(dt) {
    const intensity = controls.update(dt); // warp accelerates the zoom
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uZoom.value += (HYPERZOOM_RATE + intensity * HYPERZOOM_BOOST) * dt;
    _p.setFromMatrixPosition(camera.matrixWorld);
    shell.position.copy(_p);
  }

  function onActivate() {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    controls.reset();
  }

  return { name: "Hyperzoom", scene, update, onActivate };
}
