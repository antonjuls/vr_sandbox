import * as THREE from "three";
import { BODY_MASS } from "./config.js";

// Builds the world: lights, floor, landmark columns, stars and grabbable shapes.
// Returns { scene, grabbables, columns } — physics creates bodies from this data.
export function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.FogExp2(0x05060a, 0.05);

  // --- lights ---
  scene.add(new THREE.HemisphereLight(0x8899ff, 0x101018, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2, 5, 3);
  scene.add(dir);
  const p1 = new THREE.PointLight(0x4060ff, 18, 14);
  p1.position.set(-2, 2.2, -1);
  const p2 = new THREE.PointLight(0xff4070, 14, 14);
  p2.position.set(2, 1.4, 0.5);
  scene.add(p1, p2);
  scene.userData.lights = [p1, p2];

  // --- floor ---
  const grid = new THREE.GridHelper(40, 80, 0x335577, 0x1a2233);
  grid.material.opacity = 0.35;
  grid.material.transparent = true;
  scene.add(grid);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      color: 0x080a12,
      roughness: 0.9,
      metalness: 0.1,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  scene.add(floor);

  // --- landmark columns (also act as physics obstacles) ---
  const columns = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = 6 + (i % 3) * 2.5;
    const h = 1.2 + Math.random() * 2.5;
    const radiusTop = 0.12;
    const radiusBottom = 0.18;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, h, 8),
      new THREE.MeshStandardMaterial({
        color: 0x1c2440,
        roughness: 0.6,
        metalness: 0.3,
        emissive: 0x0a1430,
        emissiveIntensity: 0.5,
      }),
    );
    col.position.set(Math.cos(a) * rr, h / 2, Math.sin(a) * rr);
    scene.add(col);
    // for physics, approximate with the average radius (cylinder axis is Y, same as three)
    columns.push({ mesh: col, radius: (radiusTop + radiusBottom) / 2, height: h });
  }

  scene.add(makeStars());

  // --- grabbable shapes ---
  const grabbables = makeGrabbables();
  grabbables.forEach((m) => scene.add(m));

  return { scene, grabbables, columns };
}

// Platonic solids + a torus knot. Each shape carries a collider descriptor in
// userData.body: box → CANNON.Box, everything else → CANNON.Sphere from the bounding sphere.
function makeGrabbables() {
  const r = 0.13;
  const defs = [
    { geo: new THREE.TetrahedronGeometry(r * 1.25), color: 0xff6b6b, shape: "sphere" },
    {
      geo: new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6),
      color: 0x4ecdc4,
      shape: "box",
      half: [r * 0.8, r * 0.8, r * 0.8],
    },
    { geo: new THREE.OctahedronGeometry(r * 1.2), color: 0xffd166, shape: "sphere" },
    { geo: new THREE.DodecahedronGeometry(r * 1.1), color: 0xa78bfa, shape: "sphere" },
    { geo: new THREE.IcosahedronGeometry(r * 1.15), color: 0x60a5fa, shape: "sphere" },
    {
      geo: new THREE.TorusKnotGeometry(r * 0.8, r * 0.28, 120, 16),
      color: 0xf472b6,
      shape: "sphere",
    },
  ];
  const N = defs.length;
  const out = [];
  defs.forEach((d, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: d.color,
      emissive: d.color,
      emissiveIntensity: 0.12,
      metalness: 0.55,
      roughness: 0.25,
    });
    const mesh = new THREE.Mesh(d.geo, mat);
    // an even front row with a slight height jitter — shapes fall and spread out
    mesh.position.set((i - (N - 1) / 2) * 0.4, 1.4 + (i % 2 ? 0.12 : 0), -0.8);

    d.geo.computeBoundingSphere();
    mesh.userData.grabbable = true;
    mesh.userData.held = false;
    mesh.userData.baseEmissive = 0.12;
    mesh.userData.body =
      d.shape === "box"
        ? { kind: "box", half: d.half, mass: BODY_MASS }
        : { kind: "sphere", radius: d.geo.boundingSphere.radius, mass: BODY_MASS };
    out.push(mesh);
  });
  return out;
}

function makeStars() {
  const g = new THREE.BufferGeometry();
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const rr = 18 + Math.random() * 30;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = Math.abs(rr * Math.cos(ph)) * 0.6 + 1;
    pos[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({
      color: 0x9fb3ff,
      size: 0.06,
      sizeAttenuation: true,
    }),
  );
}
