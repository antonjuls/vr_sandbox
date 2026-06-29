import * as THREE from "three";
import { STREAKS } from "./config.js";

// Gigantic cosmic backdrop (megalophobia by design): a colossal ringed gas giant,
// a blazing sun, a supermassive black hole with a vast accretion disk, a spiral galaxy,
// a deep multi-layer starfield, and hyperspace streaks for warp flight.
// Everything is enormous and far away so it reads as overwhelming scale.
export function createCosmos(scene, camera) {
  const group = new THREE.Group();
  scene.add(group);

  const additive = (color, opacity) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

  // light from the sun's direction so the gas giant is lit dramatically
  const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.4);
  sunLight.position.set(-1600, 400, -600);
  scene.add(sunLight);

  // --- colossal ringed gas giant (the centrepiece) ---
  const giant = new THREE.Group();
  giant.position.set(120, 240, -1500);
  const giantBody = new THREE.Mesh(
    new THREE.SphereGeometry(340, 64, 48),
    new THREE.MeshStandardMaterial({
      color: 0x3a5a9a,
      emissive: 0x101a3a,
      emissiveIntensity: 0.5,
      roughness: 1,
      metalness: 0,
    }),
  );
  giant.add(giantBody);
  const giantAtmo = new THREE.Mesh(
    new THREE.SphereGeometry(364, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6fa8ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  giant.add(giantAtmo);
  const giantRing = new THREE.Mesh(
    new THREE.RingGeometry(430, 760, 96),
    new THREE.MeshBasicMaterial({
      color: 0xc9b08a,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  giantRing.rotation.x = Math.PI / 2 - 0.35;
  giantRing.rotation.y = 0.2;
  giant.add(giantRing);
  group.add(giant);

  // --- blazing sun ---
  const sun = new THREE.Group();
  sun.position.copy(sunLight.position);
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(180, 48, 32), additive(0xffd27a, 1)));
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(240, 32, 24), additive(0xff9a3c, 0.5)));
  sun.add(new THREE.Mesh(new THREE.SphereGeometry(360, 24, 16), additive(0xff6a2a, 0.18)));
  group.add(sun);

  // --- supermassive black hole, far off ---
  const smbh = new THREE.Group();
  smbh.position.set(1700, 700, -2400);
  smbh.add(new THREE.Mesh(new THREE.SphereGeometry(140, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 })));
  const smbhDisk = new THREE.Mesh(
    new THREE.RingGeometry(190, 560, 128),
    additive(0xffae66, 0.55),
  );
  smbhDisk.rotation.x = Math.PI / 2 - 0.5;
  smbh.add(smbhDisk);
  const photonRing = new THREE.Mesh(new THREE.TorusGeometry(165, 6, 16, 96), additive(0xffffff, 0.9));
  photonRing.rotation.x = Math.PI / 2 - 0.5;
  smbh.add(photonRing);
  group.add(smbh);

  // --- spiral galaxy, very far ---
  group.add(makeGalaxy());

  // --- deep starfield (two layers for parallax depth) ---
  group.add(makeStarLayer(4000, 2500, 6000, 1.6, 0xbcd0ff));
  group.add(makeStarLayer(3000, 6000, 11000, 3.5, 0x9fb3ff));

  // --- hyperspace streaks (parented to the camera so they wrap the viewer) ---
  const sx = new Float32Array(STREAKS);
  const sy = new Float32Array(STREAKS);
  const sz = new Float32Array(STREAKS);
  const streakPos = new Float32Array(STREAKS * 2 * 3); // head + tail per streak
  const FRONT = 12;
  const BACK = -70;
  for (let i = 0; i < STREAKS; i++) {
    const a = Math.random() * Math.PI * 2;
    const rad = 2 + Math.random() * 22;
    sx[i] = Math.cos(a) * rad;
    sy[i] = Math.sin(a) * rad;
    sz[i] = BACK + Math.random() * (FRONT - BACK);
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3));
  const streaks = new THREE.LineSegments(
    streakGeo,
    new THREE.LineBasicMaterial({
      color: 0xbfe0ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  streaks.frustumCulled = false;
  streaks.visible = false;
  camera.add(streaks); // follows the head
  let warp = 0;

  function setWarp(intensity) {
    warp = intensity;
  }

  function update(dt) {
    giantBody.rotation.y += dt * 0.01;
    giantRing.rotation.z += dt * 0.005;
    smbhDisk.rotation.z += dt * 0.04;

    // hyperspace streaks: zoom past the viewer, length scales with warp speed
    if (warp > 0.02) {
      streaks.visible = true;
      streaks.material.opacity = Math.min(1, warp * 1.2);
      const len = 1.5 + warp * 26; // faster → longer streaks
      const move = (8 + warp * 240) * dt;
      for (let i = 0; i < STREAKS; i++) {
        sz[i] += move;
        if (sz[i] > FRONT) {
          sz[i] = BACK;
          const a = Math.random() * Math.PI * 2;
          const rad = 2 + Math.random() * 22;
          sx[i] = Math.cos(a) * rad;
          sy[i] = Math.sin(a) * rad;
        }
        const j = i * 6;
        streakPos[j] = sx[i];
        streakPos[j + 1] = sy[i];
        streakPos[j + 2] = sz[i] - len; // tail (ahead)
        streakPos[j + 3] = sx[i];
        streakPos[j + 4] = sy[i];
        streakPos[j + 5] = sz[i]; // head
      }
      streakGeo.attributes.position.needsUpdate = true;
    } else if (streaks.visible) {
      streaks.visible = false;
    }
  }

  return { update, setWarp };
}

function makeStarLayer(n, rMin, rMax, size, color) {
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
  return new THREE.Points(
    g,
    new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.9 }),
  );
}

function makeGalaxy() {
  const n = 4000;
  const arms = 3;
  const radius = 3200;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const core = new THREE.Color(0xfff1c4);
  const edge = new THREE.Color(0x5577ff);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = Math.pow(Math.random(), 0.6);
    const arm = i % arms;
    const angle = t * 5 + (arm * Math.PI * 2) / arms + (Math.random() - 0.5) * 0.5;
    const r = t * radius;
    const spread = (1 - t) * 240 + 40;
    pos[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * (60 + (1 - t) * 300);
    pos[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
    c.copy(core).lerp(edge, t);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const galaxy = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  galaxy.position.set(-2600, 1400, -5200);
  galaxy.rotation.set(0.5, 0.3, 0.2);
  return galaxy;
}
