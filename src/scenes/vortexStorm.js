import * as THREE from "three";
import { createFlightControls } from "../flightControls.js";

// Scene — "Vortex Storm": thousands of shards swirling around a glowing core in
// concentric rings, each ring sheared at a different speed → a churning storm you
// fly through. Cheap: each ring is one InstancedMesh rotated as a whole (no per-shard
// CPU work), with a constant hue drift.
export function createVortexStorm(ctx) {
  const { renderer, dolly } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06010e);
  scene.fog = new THREE.FogExp2(0x0a0218, 0.0016);
  scene.add(makeStars(2200, 200, 3200));

  // glowing core
  const core = new THREE.Group();
  core.add(glow(7, 0xff66cc, 0.95));
  core.add(glow(16, 0xaa44ff, 0.4));
  core.add(glow(34, 0x4466ff, 0.14));
  scene.add(core);

  const shardGeo = new THREE.BoxGeometry(2.2, 0.35, 0.35);
  const rings = [];
  const RINGS = 26;
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();
  for (let r = 0; r < RINGS; r++) {
    const radius = 9 + r * 4.4;
    const count = 28 + r * 5;
    const hue = (r / RINGS) * 0.8;
    const mesh = new THREE.InstancedMesh(
      shardGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hue, 0.8, 0.6) }),
      count,
    );
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      pos.set(Math.cos(a) * radius, (Math.random() - 0.5) * (4 + r), Math.sin(a) * radius);
      euler.set(Math.random() * 0.6, -a + Math.PI / 2, Math.random() * 0.6);
      quat.setFromEuler(euler);
      const sc = 0.6 + Math.random() * 1.8;
      scl.set(sc, sc, sc);
      m.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    rings.push({ mesh, hue, spin: (1.4 / Math.sqrt(radius)) * (r % 2 ? 1 : -1) });
  }

  const controls = createFlightControls(renderer, dolly, { flySpeed: 9 });
  let elapsed = 0;

  function update(dt) {
    controls.update(dt);
    elapsed += dt;
    const drift = (elapsed * 0.04) % 1;
    for (const ring of rings) {
      ring.mesh.rotation.y += ring.spin * dt;
      ring.mesh.material.color.setHSL((ring.hue + drift) % 1, 0.8, 0.6);
    }
    core.rotation.y += dt * 0.3;
  }

  function onActivate() {
    dolly.position.set(0, 0, 70);
    dolly.quaternion.identity();
    controls.reset();
  }

  return { name: "Vortex Storm", scene, update, onActivate };
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
    }),
  );
}

function makeStars(n, rMin, rMax) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const rr = rMin + Math.random() * (rMax - rMin);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    p[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    p[i * 3 + 1] = rr * Math.cos(ph);
    p[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb3ff, size: 2, sizeAttenuation: true }));
}
