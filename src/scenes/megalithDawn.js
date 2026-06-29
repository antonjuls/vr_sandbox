import * as THREE from "three";
import { createLocomotion } from "../locomotion.js";
import {
  MOON_GRAVITY,
  MOON_JUMP,
  MOON_SPEED,
  SPRINT_10X,
  GIANTS,
  TITANS,
  FOREST,
} from "../config.js";

// Scene 3 — "Megalith Dawn": an ordinary planet surface with normal walking, low
// Moon-like gravity (long floaty jumps), B = 10x sprint, and a slow sunrise casting
// long shadows. The plain is littered with random geometric forms at wildly different
// scales — some colossal giants looming on the horizon for real megalophobia.
export function createMegalithDawn(ctx) {
  const { renderer, dolly } = ctx;
  const scene = new THREE.Scene();

  const SKY_TOP = new THREE.Color(0x121a3c);
  const SKY_BOT = new THREE.Color(0xff8a46);
  scene.background = new THREE.Color(0x2a2438);
  scene.fog = new THREE.FogExp2(0x5a3f48, 0.00022); // warm dawn haze → far giants fade in

  const sky = makeSky(SKY_TOP, SKY_BOT);
  scene.add(sky);

  // ground (planet surface)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000),
    new THREE.MeshStandardMaterial({ color: 0x29232e, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // dawn lighting
  scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x241a14, 0.45));
  const sun = new THREE.DirectionalLight(0xffcf9a, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1600;
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // sun disc (visual)
  const sunDisc = new THREE.Group();
  sunDisc.add(mkGlow(180, 0xfff2c0, 1));
  sunDisc.add(mkGlow(320, 0xffae5a, 0.4));
  sunDisc.add(mkGlow(520, 0xff7a3a, 0.16));
  scene.add(sunDisc);

  buildGiants(scene);

  const locomotion = createLocomotion(renderer, dolly, {
    gravity: MOON_GRAVITY,
    jumpSpeed: MOON_JUMP,
    speed: MOON_SPEED,
    sprintMultiplier: SPRINT_10X,
  });

  let elapsed = 0;
  const AZ = -2.3; // sun azimuth (dawn direction)

  function update(dt) {
    elapsed += dt;
    if (renderer.xr.isPresenting) locomotion.update(dt, false);

    // slow sunrise: elevation climbs from just above the horizon and holds
    const el = Math.min(0.1 + elapsed * 0.004, 0.5);
    const dx = Math.cos(AZ) * Math.cos(el);
    const dy = Math.sin(el);
    const dz = Math.sin(AZ) * Math.cos(el);

    // sky and sun follow the player so the world feels endless
    sky.position.copy(dolly.position);
    sunDisc.position.set(
      dolly.position.x + dx * 5000,
      dy * 5000,
      dolly.position.z + dz * 5000,
    );

    // shadow light tracks the player (shadow map covers where you are)
    sun.target.position.set(dolly.position.x, 0, dolly.position.z);
    sun.position.set(
      dolly.position.x + dx * 700,
      dy * 700,
      dolly.position.z + dz * 700,
    );
    sun.target.updateMatrixWorld();
    sun.color.setHSL(0.08, 0.75, 0.45 + el * 0.5); // warm → brighter as it rises
    sun.intensity = 1.6 + el * 1.6;
  }

  function onActivate() {
    dolly.position.set(0, 0, 0);
    dolly.quaternion.identity();
    locomotion.reset();
  }

  return { name: "Megalith Dawn", scene, update, onActivate };
}

function mkGlow(r, color, opacity) {
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

function makeSky(top, bottom) {
  const geo = new THREE.SphereGeometry(6000, 32, 24);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 6000; // -1..1
    const t = THREE.MathUtils.clamp((y + 0.12) / 0.6, 0, 1); // horizon-weighted
    c.copy(bottom).lerp(top, t);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
}

// random geometric giants — standing and floating, tiny to colossal, ominous and dark
function buildGiants(scene) {
  const geos = [
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
    new THREE.ConeGeometry(0.6, 1, 16),
    new THREE.SphereGeometry(0.6, 24, 16),
    new THREE.TetrahedronGeometry(0.7),
    new THREE.OctahedronGeometry(0.7),
    new THREE.TorusGeometry(0.55, 0.2, 14, 28),
    new THREE.TorusKnotGeometry(0.5, 0.17, 90, 14),
    new THREE.IcosahedronGeometry(0.7),
    new THREE.DodecahedronGeometry(0.62),
  ];
  const palette = [0x14161f, 0x1b2030, 0x10141c, 0x262031, 0x0d1014, 0x2c3344];
  const mats = palette.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.05 }),
  );
  const pick = (a) => a[(Math.random() * a.length) | 0];

  // non-uniform scale → towers, slabs, squat blocks, blobs (incredible forms)
  function formScale(base) {
    const r = Math.random();
    if (r < 0.32) return [base * (0.15 + Math.random() * 0.4), base * (3 + Math.random() * 7), base * (0.15 + Math.random() * 0.4)]; // tower/needle
    if (r < 0.52) return [base * (2 + Math.random() * 6), base * (2 + Math.random() * 6), base * (0.08 + Math.random() * 0.25)]; // slab / wall
    if (r < 0.7) return [base * (1.5 + Math.random() * 4), base * (0.3 + Math.random() * 0.6), base * (1.5 + Math.random() * 4)]; // squat
    return [base * (0.7 + Math.random() * 0.9), base * (0.7 + Math.random() * 0.9), base * (0.7 + Math.random() * 0.9)]; // blob
  }

  function place(base, dist, floating) {
    const mesh = new THREE.Mesh(pick(geos), pick(mats));
    const s = formScale(base);
    mesh.scale.set(s[0], s[1], s[2]);
    const a = Math.random() * Math.PI * 2;
    mesh.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
    if (floating) {
      mesh.position.y = 60 + Math.random() * 500;
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    } else {
      mesh.position.y = s[1] * 0.5; // stand on the ground
      mesh.rotation.y = Math.random() * Math.PI * 2;
      if (Math.random() < 0.15) mesh.rotation.z = (Math.random() - 0.5) * 0.5; // a few leaning
    }
    mesh.castShadow = dist < 700; // only near ones cast (far giants are silhouettes)
    scene.add(mesh);
  }

  // scattered, mixed sizes; bigger ones pushed farther so they don't spawn on top of you
  for (let i = 0; i < GIANTS; i++) {
    const base = Math.pow(2, 1 + Math.random() * 6); // ~2 .. 130
    const dist = base * 1.8 + 10 + Math.random() * 1300;
    place(base, dist, Math.random() < 0.28);
  }

  // colossal titans on the far horizon (the real megalophobia)
  for (let i = 0; i < TITANS; i++) {
    place(150 + Math.random() * 420, 1200 + Math.random() * 2400, false);
  }

  // a "forest of giants": a cluster of towering monoliths off to one side
  const fx = 520;
  const fz = -640;
  for (let i = 0; i < FOREST; i++) {
    const mesh = new THREE.Mesh(pick([geos[0], geos[1], geos[2]]), pick(mats));
    const h = 90 + Math.random() * 260;
    const w = 6 + Math.random() * 22;
    mesh.scale.set(w, h, w);
    mesh.position.set(
      fx + (Math.random() - 0.5) * 420,
      h * 0.5,
      fz + (Math.random() - 0.5) * 420,
    );
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    scene.add(mesh);
  }
}
