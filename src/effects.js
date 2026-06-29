import * as THREE from "three";
import { getPads, button } from "./input.js";
import { randomGrabbable } from "./scene.js";
import {
  GRAVITY,
  BH_DISTANCE,
  BH_PULL,
  BH_MAX_ACCEL,
  BH_SWIRL,
  BH_RADIUS,
  BH_HORIZON,
  BH_REACH,
  SWIRL_PARTICLES,
  BLAST_RADIUS,
  BLAST_IMPULSE,
  MAX_SHAPES,
  SPAWN_SPEED,
  PARTICLES,
} from "./config.js";

// "Singularity sandbox" — the wild stuff on the LEFT hand:
//   left X      → spawn a shape (launched along your gaze; recycles oldest past MAX_SHAPES)
//   left Y      → toggle a black hole ahead of your gaze (pulls/swirls/swallows shapes)
//   left grip   → force blast that shoves nearby shapes away
// Plus a pooled particle system used for swallows, blasts and spawns.
export function createEffects({ scene, renderer, physics, grabbables }) {
  let t = 0; // time accumulator for pulsing visuals
  let xPrev = false, yPrev = false, gPrev = false; // button edge-detect

  // reusable temporaries (no per-frame allocations)
  const _hp = new THREE.Vector3();
  const _hq = new THREE.Quaternion();
  const _hf = new THREE.Vector3();
  const _toSwallow = [];
  const COL_BH = new THREE.Color(0xaa66ff);
  const COL_COLLAPSE = new THREE.Color(0xffffff);
  const COL_BLAST = new THREE.Color(0x88ccff);

  // ---------- particle burst pool ----------
  const pPos = new Float32Array(PARTICLES * 3);
  const pCol = new Float32Array(PARTICLES * 3);
  const pVel = new Float32Array(PARTICLES * 3);
  const pLife = new Float32Array(PARTICLES);
  for (let i = 0; i < PARTICLES; i++) pPos[i * 3 + 1] = -9999; // park dead particles
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  scene.add(points);
  let pCursor = 0;

  function burst(pos, color, count, speed) {
    for (let k = 0; k < count; k++) {
      const i = pCursor;
      pCursor = (pCursor + 1) % PARTICLES;
      const j = i * 3;
      pPos[j] = pos.x;
      pPos[j + 1] = pos.y;
      pPos[j + 2] = pos.z;
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      const sp = speed * (0.4 + Math.random() * 0.6);
      pVel[j] = sq * Math.cos(th) * sp;
      pVel[j + 1] = u * sp;
      pVel[j + 2] = sq * Math.sin(th) * sp;
      pCol[j] = color.r;
      pCol[j + 1] = color.g;
      pCol[j + 2] = color.b;
      pLife[i] = 0.6 + Math.random() * 0.6;
    }
    pGeo.attributes.color.needsUpdate = true;
  }

  function updateParticles(dt) {
    for (let i = 0; i < PARTICLES; i++) {
      if (pLife[i] <= 0) continue;
      pLife[i] -= dt;
      const j = i * 3;
      pVel[j + 1] -= GRAVITY * 0.4 * dt;
      pVel[j] *= 0.98;
      pVel[j + 1] *= 0.98;
      pVel[j + 2] *= 0.98;
      pPos[j] += pVel[j] * dt;
      pPos[j + 1] += pVel[j + 1] * dt;
      pPos[j + 2] += pVel[j + 2] * dt;
      pCol[j] *= 0.95;
      pCol[j + 1] *= 0.95;
      pCol[j + 2] *= 0.95; // fade out (additive → dims to invisible)
      if (pLife[i] <= 0) pPos[j + 1] = -9999; // park when dead
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  // ---------- black hole visuals ----------
  const bhGroup = new THREE.Group();
  bhGroup.visible = false;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(BH_RADIUS, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000 }),
  );
  bhGroup.add(core);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(BH_RADIUS * 1.35, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0x7733dd,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  bhGroup.add(halo);
  const disk = new THREE.Mesh(
    new THREE.RingGeometry(BH_RADIUS * 1.5, BH_RADIUS * 3.4, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff7a33,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  disk.rotation.x = -Math.PI / 2 + 0.4; // tilt the accretion disk
  bhGroup.add(disk);

  // orbiting swirl particles (local to the group)
  const sPos = new Float32Array(SWIRL_PARTICLES * 3);
  const sR = new Float32Array(SWIRL_PARTICLES);
  const sAng = new Float32Array(SWIRL_PARTICLES);
  const sSpd = new Float32Array(SWIRL_PARTICLES);
  const sY = new Float32Array(SWIRL_PARTICLES);
  const TILT = 0.4;
  for (let i = 0; i < SWIRL_PARTICLES; i++) {
    sR[i] = BH_RADIUS * 1.4 + Math.random() * BH_RADIUS * 2.4;
    sAng[i] = Math.random() * Math.PI * 2;
    sSpd[i] = (BH_RADIUS / sR[i]) * (6 + Math.random() * 4); // inner orbits faster
    sY[i] = (Math.random() - 0.5) * BH_RADIUS * 0.6;
  }
  const swirlGeo = new THREE.BufferGeometry();
  swirlGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  const swirl = new THREE.Points(
    swirlGeo,
    new THREE.PointsMaterial({
      color: 0xffbb66,
      size: 0.04,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  swirl.frustumCulled = false;
  bhGroup.add(swirl);
  scene.add(bhGroup);

  const blackHole = { active: false, pos: new THREE.Vector3() };
  let bhScale = 1;

  function updateBlackHole(dt) {
    halo.material.opacity = 0.3 + 0.12 * Math.sin(t * 5);
    disk.material.opacity = 0.5 + 0.15 * Math.sin(t * 3 + 1);
    for (let i = 0; i < SWIRL_PARTICLES; i++) {
      sAng[i] += sSpd[i] * dt;
      sR[i] -= dt * 0.04; // slow inward drift
      if (sR[i] < BH_RADIUS * 1.2) sR[i] = BH_RADIUS * 1.4 + Math.random() * BH_RADIUS * 2.4;
      const x = Math.cos(sAng[i]) * sR[i];
      const z = Math.sin(sAng[i]) * sR[i];
      const y0 = sY[i];
      const j = i * 3;
      sPos[j] = x; // tilt the swirl plane to match the disk
      sPos[j + 1] = y0 * Math.cos(TILT) - z * Math.sin(TILT);
      sPos[j + 2] = y0 * Math.sin(TILT) + z * Math.cos(TILT);
    }
    swirlGeo.attributes.position.needsUpdate = true;
  }

  // ---------- blast shockwave pool ----------
  const shocks = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 12),
      new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    m.visible = false;
    scene.add(m);
    shocks.push({ mesh: m, age: 0, alive: false });
  }

  function spawnShock(pos) {
    const s = shocks.find((s) => !s.alive) || shocks[0];
    s.mesh.position.set(pos.x, pos.y, pos.z);
    s.mesh.scale.setScalar(0.2);
    s.mesh.material.opacity = 0.6;
    s.mesh.visible = true;
    s.age = 0;
    s.alive = true;
  }

  function updateShocks(dt) {
    for (const s of shocks) {
      if (!s.alive) continue;
      s.age += dt;
      const k = s.age / 0.5; // 0.5 s life
      if (k >= 1) {
        s.alive = false;
        s.mesh.visible = false;
        continue;
      }
      s.mesh.scale.setScalar(0.2 + k * BLAST_RADIUS);
      s.mesh.material.opacity = 0.6 * (1 - k);
    }
  }

  // ---------- shape lifecycle ----------
  function removeShape(mesh) {
    physics.remove(mesh);
    scene.remove(mesh);
    const i = grabbables.indexOf(mesh);
    if (i >= 0) grabbables.splice(i, 1);
    mesh.material.dispose(); // geometry is shared, only the material is per-instance
  }

  function headPose() {
    const cam = renderer.xr.getCamera();
    _hp.setFromMatrixPosition(cam.matrixWorld);
    _hq.setFromRotationMatrix(cam.matrixWorld);
    _hf.set(0, 0, -1).applyQuaternion(_hq).normalize();
  }

  function spawnShape() {
    if (grabbables.length >= MAX_SHAPES) {
      const old = grabbables.find((m) => !m.userData.held);
      if (old) removeShape(old);
    }
    headPose();
    const px = _hp.x + _hf.x * 0.7;
    const py = Math.max(_hp.y + _hf.y * 0.7, 0.5);
    const pz = _hp.z + _hf.z * 0.7;
    const mesh = randomGrabbable([px, py, pz]);
    scene.add(mesh);
    grabbables.push(mesh);
    physics.addGrabbable(mesh);
    mesh.userData.body3d.velocity.set(_hf.x * SPAWN_SPEED, 2.6, _hf.z * SPAWN_SPEED);
    burst({ x: px, y: py, z: pz }, mesh.material.color, 16, 1.6);
  }

  function toggleBlackHole() {
    if (blackHole.active) {
      burst(blackHole.pos, COL_COLLAPSE, 90, 3.5); // implosion flash
      blackHole.active = false;
      bhGroup.visible = false;
      return;
    }
    headPose();
    blackHole.pos.set(
      _hp.x + _hf.x * BH_DISTANCE,
      Math.min(Math.max(_hp.y + _hf.y * BH_DISTANCE, 1.0), 2.4),
      _hp.z + _hf.z * BH_DISTANCE,
    );
    bhScale = 1;
    bhGroup.scale.setScalar(1);
    bhGroup.position.copy(blackHole.pos);
    bhGroup.visible = true;
    blackHole.active = true;
    burst(blackHole.pos, COL_BH, 40, 2.5);
  }

  function swallow(mesh) {
    burst(mesh.position, mesh.material.color, 30, 2.5);
    removeShape(mesh);
    bhScale = Math.min(bhScale + 0.05, 2.2); // the hole grows as it feeds
    bhGroup.scale.setScalar(bhScale);
  }

  function blast() {
    headPose();
    physics.eachDynamic((body) => {
      const dx = body.position.x - _hp.x;
      const dy = body.position.y - _hp.y;
      const dz = body.position.z - _hp.z;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r > BLAST_RADIUS || r < 1e-3) return;
      const f = (BLAST_IMPULSE * (1 - r / BLAST_RADIUS)) / r; // stronger near the centre
      body.wakeUp();
      body.velocity.x += dx * f;
      body.velocity.y += dy * f + 1.5; // a little lift
      body.velocity.z += dz * f;
    });
    spawnShock(_hp);
    burst(_hp, COL_BLAST, 70, 4);
  }

  function applyBlackHole(dt) {
    physics.eachDynamic((body, mesh) => {
      const dx = blackHole.pos.x - body.position.x;
      const dy = blackHole.pos.y - body.position.y;
      const dz = blackHole.pos.z - body.position.z;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-3;
      if (r > BH_REACH) return;
      if (r < BH_HORIZON) {
        _toSwallow.push(mesh);
        return;
      }
      const inv = 1 / r;
      const ux = dx * inv, uy = dy * inv, uz = dz * inv; // direction toward the hole
      const accel = Math.min(BH_PULL / (r * r), BH_MAX_ACCEL);
      body.wakeUp();
      body.velocity.x += ux * accel * dt;
      body.velocity.y += uy * accel * dt;
      body.velocity.z += uz * accel * dt;
      // swirl: tangent = up × dir = (uz, 0, -ux), so shapes orbit instead of dropping straight in
      const tl = Math.hypot(uz, ux) || 1;
      const sw = ((BH_SWIRL / r) * dt) / tl;
      body.velocity.x += uz * sw;
      body.velocity.z += -ux * sw;
    });
    for (const m of _toSwallow) swallow(m);
    _toSwallow.length = 0;
    updateBlackHole(dt);
  }

  function update(dt) {
    t += dt;
    const { left } = getPads(renderer);
    const x = button(left, 4);
    const y = button(left, 5);
    const g = button(left, 1);
    if (x && !xPrev) spawnShape();
    if (y && !yPrev) toggleBlackHole();
    if (g && !gPrev) blast();
    xPrev = x;
    yPrev = y;
    gPrev = g;

    if (blackHole.active) applyBlackHole(dt);
    updateParticles(dt);
    updateShocks(dt);
  }

  return { update };
}
