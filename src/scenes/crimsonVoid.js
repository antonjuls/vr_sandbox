import * as THREE from "three";
import { createFlightControls } from "../flightControls.js";
import { VOID_MONOLITHS } from "../config.js";

// Scene — "Crimson Void": a blood-red murk where colossal dark monoliths loom out of the
// fog and slowly breathe (scale-pulse), a distant heart throbs in a double-thump rhythm
// that drives the light, and embers drift through the haze. Pure dread. Fly through it.
export function createCrimsonVoid(ctx) {
  const { renderer, dolly } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120305);
  scene.fog = new THREE.FogExp2(0x3a0408, 0.009); // thick crimson murk

  scene.add(new THREE.HemisphereLight(0x5a0a10, 0x050102, 0.35));
  const pulseLight = new THREE.PointLight(0xff1020, 1.0, 1400, 1.1); // throbs with the heartbeat
  pulseLight.position.set(0, 70, -260);
  scene.add(pulseLight);
  const fill = new THREE.DirectionalLight(0x40060a, 0.5);
  fill.position.set(-200, 120, 220);
  scene.add(fill);

  // distant throbbing "heart" — a red bloom that pierces the fog (glows are fog-free)
  const heart = new THREE.Group();
  const heartCore = new THREE.Mesh(
    new THREE.SphereGeometry(120, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x8a0010 }),
  );
  heart.add(heartCore);
  heart.add(glow(180, 0xff0a1a, 0.42));
  heart.add(glow(300, 0xaa0010, 0.16));
  heart.position.set(0, 90, -1500);
  scene.add(heart);

  const monos = buildMonoliths(scene);
  const embers = makeEmbers(900);
  scene.add(embers.points);

  const controls = createFlightControls(renderer, dolly, { flySpeed: 9 });
  let t = 0;

  function update(dt) {
    controls.update(dt);
    t += dt;
    const hb = heartbeat(t);

    // the heart throbs; the murk pulses red with it
    heart.scale.setScalar(1 + hb * 0.12);
    heartCore.material.color.setHSL(0.99, 1.0, 0.16 + hb * 0.24);
    pulseLight.intensity = 0.5 + hb * 3.4;

    // monoliths breathe, each at its own slow rate/phase
    for (const m of monos) {
      const s = 1 + Math.sin(t * m.rate + m.phase) * m.amp;
      m.mesh.scale.set(m.sx * s, m.sy * s, m.sz * s);
    }

    embers.update(dt);
  }

  function onActivate() {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    controls.reset();
  }

  return { name: "Crimson Void", scene, update, onActivate };
}

// double-thump heartbeat envelope, ~1.1 s cycle, returns 0..~1
function heartbeat(time) {
  const c = (time % 1.1) / 1.1;
  const a = Math.exp(-Math.pow((c - 0.1) * 9.0, 2));
  const b = Math.exp(-Math.pow((c - 0.28) * 11.0, 2)) * 0.7;
  return Math.min(a + b, 1);
}

function glow(r, color, opacity) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
}

function buildMonoliths(scene) {
  const geos = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    new THREE.ConeGeometry(0.6, 1, 14),
    new THREE.SphereGeometry(0.6, 24, 16),
    new THREE.TetrahedronGeometry(0.7),
    new THREE.OctahedronGeometry(0.7),
    new THREE.DodecahedronGeometry(0.62),
    new THREE.TorusKnotGeometry(0.5, 0.18, 80, 12),
  ];
  const mats = [0x140406, 0x1a0508, 0x0e0204, 0x220a0c].map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.92,
        metalness: 0.08,
        emissive: 0x2a0006,
        emissiveIntensity: 0.35,
      }),
  );
  const pick = (a) => a[(Math.random() * a.length) | 0];

  function form(base) {
    const r = Math.random();
    if (r < 0.4) return [base * (0.15 + Math.random() * 0.4), base * (3 + Math.random() * 8), base * (0.15 + Math.random() * 0.4)]; // towering slab/needle
    if (r < 0.6) return [base * (2 + Math.random() * 5), base * (2 + Math.random() * 5), base * (0.1 + Math.random() * 0.3)]; // wall
    return [base * (0.7 + Math.random() * 1.0), base * (0.7 + Math.random() * 1.0), base * (0.7 + Math.random() * 1.0)]; // blob
  }

  const monos = [];
  const add = (base, dist) => {
    const mesh = new THREE.Mesh(pick(geos), pick(mats));
    const s = form(base);
    const a = Math.random() * Math.PI * 2;
    mesh.position.set(Math.cos(a) * dist, (Math.random() - 0.4) * dist * 0.8, Math.sin(a) * dist);
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 0.6);
    mesh.scale.set(s[0], s[1], s[2]);
    scene.add(mesh);
    monos.push({ mesh, sx: s[0], sy: s[1], sz: s[2], rate: 0.25 + Math.random() * 0.6, phase: Math.random() * 6, amp: 0.05 + Math.random() * 0.08 });
  };

  for (let i = 0; i < VOID_MONOLITHS; i++) {
    const base = Math.pow(2, 2 + Math.random() * 5.5); // ~4 .. 180
    add(base, base * 1.6 + 20 + Math.random() * 700);
  }
  // a few colossal ones looming far in the murk
  for (let i = 0; i < 8; i++) add(220 + Math.random() * 320, 900 + Math.random() * 1600);
  return monos;
}

function makeEmbers(n) {
  const pos = new Float32Array(n * 3);
  const vy = new Float32Array(n);
  const span = 420;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * span;
    pos[i * 3 + 1] = (Math.random() - 0.5) * span;
    pos[i * 3 + 2] = (Math.random() - 0.5) * span;
    vy[i] = 2 + Math.random() * 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      color: 0xff4422,
      size: 1.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  points.frustumCulled = false;

  function update(dt) {
    for (let i = 0; i < n; i++) {
      pos[i * 3 + 1] += vy[i] * dt;
      if (pos[i * 3 + 1] > span / 2) pos[i * 3 + 1] = -span / 2; // wrap (embers rise)
    }
    g.attributes.position.needsUpdate = true;
  }

  return { points, update };
}
