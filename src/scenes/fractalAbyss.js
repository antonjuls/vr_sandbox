import * as THREE from "three";
import { createFlightControls } from "../flightControls.js";
import { ABYSS_REP, ABYSS_SCALE } from "../config.js";

// Scene — "Fractal Abyss": a genuinely infinite 3D fractal raymarched in a fragment
// shader (folded Sierpinski / KIFS), domain-repeated through space so you can fly
// through it forever. The shader runs on a sphere kept around the head; `cameraPosition`
// (set by three per eye) drives the ray origin, so flying = traversing the fractal.
// Heavy — it raymarches every pixel. Tune ABYSS_REP / ABYSS_SCALE / step counts to taste.
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
  uniform float uRep;
  uniform float uScale;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  // folded-Sierpinski distance estimator (KIFS)
  float de(vec3 z, out float trap) {
    float scale = 2.0;
    float c = 1.0 + 0.12 * sin(uTime * 0.15);
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

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - cameraPosition);
    float t = 0.0;
    float trap = 0.0;
    bool hit = false;
    float tt = 0.0;
    int sN = 0;
    for (int i = 0; i < 72; i++) {
      vec3 pos = ro + rd * t;
      vec3 q = mod(pos + 0.5 * uRep, uRep) - 0.5 * uRep; // infinite tiling
      float tr;
      float d = de(q * uScale, tr) / uScale;
      trap = tr;
      if (d < 0.0012 * t + 0.0009) { hit = true; tt = t; sN = i; break; }
      t += d;
      if (t > 220.0) break;
    }
    vec3 col;
    if (hit) {
      float it = float(sN) / 72.0;
      float tn = clamp(trap * 0.6, 0.0, 1.0);
      vec3 base = mix(uColorA, uColorB, tn);
      float fade = 1.0 / (1.0 + tt * 0.015);
      col = base * (0.35 + 0.65 * (1.0 - it)) * fade + base * 0.22;
    } else {
      float g = 0.5 + 0.5 * rd.y;
      col = mix(vec3(0.03, 0.0, 0.06), vec3(0.0, 0.03, 0.08), g);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createFractalAbyss(ctx) {
  const { renderer, camera, dolly } = ctx;
  const scene = new THREE.Scene();

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uRep: { value: ABYSS_REP },
      uScale: { value: ABYSS_SCALE },
      uColorA: { value: new THREE.Color(0x33ffcc) },
      uColorB: { value: new THREE.Color(0xff2b8a) },
    },
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 24), mat);
  shell.frustumCulled = false;
  scene.add(shell);

  const controls = createFlightControls(renderer, dolly, { flySpeed: 10 });
  const _p = new THREE.Vector3();

  function update(dt) {
    controls.update(dt);
    mat.uniforms.uTime.value += dt;
    // keep the shader shell wrapped around the head
    _p.setFromMatrixPosition(camera.matrixWorld);
    shell.position.copy(_p);
  }

  function onActivate() {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    controls.reset();
  }

  return { name: "Fractal Abyss", scene, update, onActivate };
}
