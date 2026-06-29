import * as THREE from "three";
import { createFlightControls } from "../flightControls.js";
import { ping } from "../audio.js";

// Scene — "Clockwork Titans": colossal nested rings and cog-wheels of a vast machine,
// each turning on its own axis like a gyroscopic orrery, with giant gears looming in a
// warm, dramatic light. Mechanical megalophobia — fly between the turning titans.
export function createClockworkTitans(ctx) {
  const { renderer, dolly } = ctx;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0805);
  scene.fog = new THREE.FogExp2(0x140d06, 0.0009);

  scene.add(new THREE.HemisphereLight(0x8a6a44, 0x080604, 0.5));
  const key = new THREE.DirectionalLight(0xffd9a0, 1.7);
  key.position.set(400, 600, 300);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x3a60ff, 0.8);
  rim.position.set(-500, 120, -400);
  scene.add(rim);

  const metal = (color) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: 0.34, emissive: 0x140a02, emissiveIntensity: 0.6 });
  const COLORS = [0x6b5a3a, 0x4a4a52, 0x7a5230, 0x3a4458];
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const parts = [];
  const rndAxis = () =>
    new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();

  // central nested gyroscope of giant rings
  for (let i = 0; i < 8; i++) {
    const R = 50 + i * 70;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 4 + i * 1.8, 16, 96), metal(pick(COLORS)));
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    scene.add(ring);
    parts.push({ obj: ring, ax: rndAxis(), sp: (0.05 + Math.random() * 0.25) * (i % 2 ? 1 : -1) });
  }

  // colossal cog-wheels scattered around (flat cylinders with teeth-ish boxes)
  for (let i = 0; i < 14; i++) {
    const gear = new THREE.Group();
    const R = 40 + Math.random() * 160;
    const th = 6 + Math.random() * 20;
    gear.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, th, 7 + ((Math.random() * 10) | 0)), metal(pick(COLORS))));
    const teeth = 10 + ((Math.random() * 14) | 0);
    const toothGeo = new THREE.BoxGeometry(R * 0.32, th, R * 0.32);
    const toothMat = metal(pick(COLORS));
    const tm = new THREE.Matrix4();
    const teethMesh = new THREE.InstancedMesh(toothGeo, toothMat, teeth);
    for (let k = 0; k < teeth; k++) {
      const a = (k / teeth) * Math.PI * 2;
      tm.makeTranslation(Math.cos(a) * R, 0, Math.sin(a) * R);
      teethMesh.setMatrixAt(k, tm);
    }
    teethMesh.instanceMatrix.needsUpdate = true;
    gear.add(teethMesh);
    gear.position.set((Math.random() - 0.5) * 2400, (Math.random() - 0.5) * 1400, (Math.random() - 0.5) * 2400);
    gear.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(gear);
    parts.push({ obj: gear, ax: rndAxis(), sp: (0.1 + Math.random() * 0.4) * (i % 2 ? 1 : -1) });
  }

  // a central monolithic spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(8, 16, 700, 8), metal(0x2a2a30));
  scene.add(spire);
  parts.push({ obj: spire, ax: new THREE.Vector3(0, 1, 0), sp: 0.04 });

  const controls = createFlightControls(renderer, dolly, { flySpeed: 10 });
  let tick = 1;
  let gong = 4;

  function update(dt) {
    controls.update(dt);
    for (const p of parts) p.obj.rotateOnAxis(p.ax, p.sp * dt);
    tick -= dt;
    if (tick <= 0) {
      tick = 0.5 + Math.random() * 0.9;
      if (renderer.xr.isPresenting)
        ping({ freq: 150 + Math.random() * 160, partials: [1, 2.76, 5.4], dur: 0.5, gain: 0.1, position: parts[(Math.random() * parts.length) | 0].obj.position }); // metallic clank
    }
    gong -= dt;
    if (gong <= 0) {
      gong = 6 + Math.random() * 6;
      if (renderer.xr.isPresenting)
        ping({ freq: 64, partials: [1, 2.76, 5.4, 8.1], dur: 3.2, gain: 0.18, position: parts[(Math.random() * parts.length) | 0].obj.position }); // deep gong
    }
  }

  function onActivate() {
    dolly.position.set(0, 0, 360);
    dolly.quaternion.identity();
    controls.reset();
  }

  return { name: "Clockwork Titans", scene, update, onActivate };
}
