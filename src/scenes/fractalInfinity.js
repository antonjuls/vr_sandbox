import * as THREE from "three";
import { createFlight } from "../flight.js";
import { getPads, button } from "../input.js";
import { FRACTAL_DEPTH, FRACTAL_SIZE } from "../config.js";

// Scene 2 — "Fractal Infinity": a colossal Menger sponge with self-similar nested
// copies and a field of giant ones. Fly through the tunnels (left grip = warp),
// morph the look (left X), with a constant hue drift. No gravity, no floor — pure fractal.
export function createFractalInfinity(ctx) {
  const { renderer, camera, dolly, controllers } = ctx;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);
  scene.add(makeStars(3000, 300, 5000));

  const menger = buildMenger(FRACTAL_DEPTH);
  const sponges = [];

  // nested self-similar copies at the centre → infinite-zoom feel
  const nested = [
    { size: FRACTAL_SIZE, spin: 0.05 },
    { size: FRACTAL_SIZE / 3, spin: -0.1 },
    { size: FRACTAL_SIZE / 9, spin: 0.18 },
  ];
  for (const lv of nested) {
    const mesh = makeSponge(menger, lv.size);
    scene.add(mesh);
    sponges.push({ mesh, spin: lv.spin });
  }

  // a few colossal ones looming in the distance (scale terror)
  const field = [
    [-1100, 250, -1500],
    [1300, -350, -1900],
    [200, 950, -3000],
  ];
  for (const p of field) {
    const mesh = makeSponge(menger, 560);
    mesh.position.set(p[0], p[1], p[2]);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    scene.add(mesh);
    sponges.push({ mesh, spin: 0.01 });
  }

  const flight = createFlight(renderer, dolly);
  let gripPrev = false;
  let xPrev = false;
  let wire = false;
  let huePhase = 0;
  let elapsed = 0;

  function morph() {
    wire = !wire; // solid <-> wireframe is a dramatic, cheap re-look
    huePhase = Math.random();
    for (const s of sponges) {
      s.mesh.material.wireframe = wire;
      s.spin = (Math.random() - 0.5) * 0.35;
    }
  }

  function update(dt) {
    elapsed += dt;
    let intensity = 0;
    if (renderer.xr.isPresenting) {
      const { left } = getPads(renderer);
      const grip = button(left, 1);
      intensity = flight.update(dt, grip ? 1 : 0);
      gripPrev = grip;
      const x = button(left, 4);
      if (x && !xPrev) morph();
      xPrev = x;
    } else {
      intensity = flight.update(dt, 0);
    }

    const boost = 1 + intensity * 4; // warping spins the fractal faster — extra trippy
    const hue = (elapsed * 0.03 + huePhase) % 1;
    for (const s of sponges) {
      s.mesh.rotation.y += s.spin * boost * dt;
      s.mesh.rotation.x += s.spin * 0.5 * boost * dt;
      s.mesh.material.color.setHSL(hue, 0.55, 1); // multiplies the per-cube rainbow → global drift
    }
  }

  function onActivate() {
    dolly.position.set(0, 0, FRACTAL_SIZE * 0.9);
    dolly.quaternion.identity();
    flight.reset();
  }

  return { name: "Fractal Infinity", scene, update, onActivate };
}

// Menger sponge cell centres in [-0.5, 0.5]; keep a subcube when >= 2 of its 3 offsets are non-zero.
function buildMenger(depth) {
  let cells = [[0, 0, 0]];
  let scale = 1;
  for (let d = 0; d < depth; d++) {
    const ns = scale / 3;
    const next = [];
    for (const [cx, cy, cz] of cells) {
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++) {
            const nz = (i !== 0 ? 1 : 0) + (j !== 0 ? 1 : 0) + (k !== 0 ? 1 : 0);
            if (nz < 2) continue; // remove the 7 Menger holes
            next.push([cx + i * ns, cy + j * ns, cz + k * ns]);
          }
    }
    cells = next;
    scale = ns;
  }
  return { positions: cells, cube: scale };
}

function makeSponge(menger, size) {
  const s = menger.cube * size * 0.96;
  const geo = new THREE.BoxGeometry(s, s, s);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), menger.positions.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < menger.positions.length; i++) {
    const p = menger.positions[i];
    m.makeTranslation(p[0] * size, p[1] * size, p[2] * size);
    mesh.setMatrixAt(i, m);
    col.setHSL((p[0] + p[1] + p[2] + 0.75) % 1, 0.7, 0.55); // rainbow by position
    mesh.setColorAt(i, col);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

function makeStars(n, rMin, rMax) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const rr = rMin + Math.random() * (rMax - rMin);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = rr * Math.cos(ph);
    pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb3ff, size: 2.2, sizeAttenuation: true }));
}
