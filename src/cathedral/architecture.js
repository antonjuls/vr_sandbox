import * as THREE from "three";
import { CATHEDRAL } from "../config.js";

// Architecture for "The Threshold Cathedral". Builds the seven connected zones along a
// single -Z promenade and returns animated handles for the systems to drive. Everything
// is instanced or shares a unit box / a few concrete materials, and nothing casts shadows
// (the global shadow map stays free) so it runs on a standalone headset.
//
// Zones (near -> far): Arrival Hall, Infinite Corridor, Stairwell of Wrong Angles,
// Observation Void, Breathing Archive, Door Field, Final Cathedral. The colossal door at
// the far end is faintly visible from the very start; you walk the whole way to it.

export function buildCathedral(scene) {
  const C = CATHEDRAL;
  const root = new THREE.Group();
  scene.add(root);

  // ---- shared geometry + concrete materials (cheap, reused everywhere) ----
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const concrete = (color, roughness = 0.92) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
  const mats = {
    pale: concrete(0x70757d),
    mid: concrete(0x4c505a),
    dark: concrete(0x2b2f36),
    stain: concrete(0x35332f, 0.98),
    metal: new THREE.MeshStandardMaterial({ color: 0x53565d, roughness: 0.5, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0c0f15, roughness: 0.14, metalness: 0.55 }), // wet black floor
  };
  const pick = (a) => a[(Math.random() * a.length) | 0];

  // a scaled box helper (uses the shared unit geometry)
  const slab = (mat, x, y, z, w, h, d, parent = root) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // fog-free additive glow (light leaks, distant doorway)
  const glow = (w, h, color, opacity, parent = root) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    parent.add(m);
    return m;
  };

  // ---- promenade anchors (metres along -Z) ----
  const cl = C.corridor.length;
  const Z = { arrival: 0, corrA: -50, corrB: -50 - cl };
  Z.stair = Z.corrB - 60;
  Z.balcony = Z.stair - 90;
  Z.archive = Z.balcony - 120;
  Z.door = Z.archive - 220;
  Z.final = Z.door - 220;

  const handles = {
    root,
    mats,
    lamps: [], // emissive light tubes (flicker on emissiveIntensity)
    pointLights: [], // the few real lights (flicker on intensity)
    breathing: [], // archive shelves that swell/contract
    chains: [], // swaying hung chains
    slabs: [], // creaking suspended slabs overhead
    doors: [], // special non-Euclidean doors
    entities: [], // distant silhouettes + void crossers
    voidLights: null, // tiny lights far down in the void
    finalDoor: null,
    corridorEnd: null, // retreats as you approach (ScaleDistortion)
    interactives: [], // ray-pickable doors (trigger nudges them open a crack)
    gates: [], // threshold z-lines with per-zone fog targets
  };

  // ===================== floor (segmented, with a void gap at the balcony) =====================
  // One continuous wet-glass floor, except a gap over the Observation Void where only a
  // narrow bridge crosses. You can't actually fall (locomotion clamps you to y>=0) — the
  // abyss is pure dread.
  const floorAt = (zNear, zFar, width = 200) => {
    const len = Math.abs(zFar - zNear);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(width, len), mats.glass);
    f.rotation.x = -Math.PI / 2;
    f.position.set(0, 0, (zNear + zFar) / 2);
    root.add(f);
    return f;
  };
  const voidNear = Z.balcony + 14;
  const voidFar = Z.balcony - 30;
  floorAt(Z.arrival + 30, voidNear); // arrival -> balcony lip
  floorAt(voidNear, voidFar, 7); // the bridge across the void (narrow)
  floorAt(voidFar, Z.final - 60, 1000); // archive -> cathedral (wide: grounds the door field)

  // ===================== Arrival Hall =====================
  // A vast empty hall: black-glass floor, walls lost in the dark, the giant lit door far away.
  (function arrivalHall() {
    slab(mats.mid, -95, 35, Z.corrA / 2 + 15, 6, 70, 180); // far side walls (huge, dim)
    slab(mats.mid, 95, 35, Z.corrA / 2 + 15, 6, 70, 180);
    // a few monumental pilasters down each wall (instanced)
    const N = 12;
    const im = new THREE.InstancedMesh(BOX, mats.dark, N * 2);
    im.frustumCulled = false; // instances span far past the origin box
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const z = 20 - i * 16;
      for (const sx of [-88, 88]) {
        d.position.set(sx, 28, z);
        d.scale.set(5, 56, 5);
        d.updateMatrix();
        im.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), d.matrix);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    root.add(im);
  })();

  // ===================== Infinite Corridor =====================
  // Normal at first, then it stretches: the far doorway recedes and swells as you approach.
  (function corridor() {
    const w = C.corridor.width;
    const h = C.corridor.height;
    const g = new THREE.Group();
    root.add(g);
    // long walls + ceiling
    slab(mats.pale, -w, h / 2, (Z.corrA + Z.corrB) / 2, 2, h, cl, g);
    slab(mats.pale, w, h / 2, (Z.corrA + Z.corrB) / 2, 2, h, cl, g);
    slab(mats.dark, 0, h, (Z.corrA + Z.corrB) / 2, w * 2, 2, cl, g); // ceiling
    // structural bays (instanced ribs) + doorways that grow with distance
    const bays = C.corridor.bays;
    const ribs = new THREE.InstancedMesh(BOX, mats.mid, bays * 2);
    ribs.frustumCulled = false;
    const d = new THREE.Object3D();
    for (let i = 0; i < bays; i++) {
      const z = Z.corrA - (i + 0.5) * (cl / bays);
      for (const sx of [-1, 1]) {
        d.position.set(sx * (w - 1.2), h / 2, z);
        d.scale.set(1.6, h, 1.6);
        d.updateMatrix();
        ribs.setMatrixAt(i * 2 + (sx > 0 ? 1 : 0), d.matrix);
      }
    }
    ribs.instanceMatrix.needsUpdate = true;
    g.add(ribs);

    // the receding far doorway (ScaleDistortion drives it). A frame around a dim opening.
    const end = new THREE.Group();
    end.position.set(0, 0, Z.corrB);
    const fh = h * 0.8;
    slab(mats.metal, -5, fh / 2, 0, 2.2, fh, 3, end); // jambs
    slab(mats.metal, 5, fh / 2, 0, 2.2, fh, 3, end);
    slab(mats.metal, 0, fh, 0, 12, 2.5, 3, end); // lintel
    end.add(glow(8, fh, 0x2a3340, 0.5)); // faint cold leak from beyond
    root.add(end);
    handles.corridorEnd = { group: end, baseZ: Z.corrB };
  })();

  // ===================== Stairwell of Wrong Angles =====================
  // A sculpture of flights going up, down, sideways and into walls. One instanced mesh for
  // every step across every flight (1 draw call).
  (function stairwell() {
    const flights = 11;
    const steps = 12;
    const im = new THREE.InstancedMesh(BOX, mats.stain, flights * steps);
    im.frustumCulled = false;
    const d = new THREE.Object3D();
    const cx = 0;
    const cy = 14;
    const cz = Z.stair;
    let n = 0;
    for (let f = 0; f < flights; f++) {
      // a random wrong orientation per flight
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.4) * 1.6; // some climb, some plunge, some flat
      const ox = cx + (Math.random() - 0.5) * 44;
      const oy = cy + (Math.random() - 0.5) * 26;
      const oz = cz + (Math.random() - 0.5) * 50;
      const dir = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
      for (let s = 0; s < steps; s++) {
        const p = new THREE.Vector3(ox, oy, oz).addScaledVector(dir, s * 2.4);
        d.position.copy(p);
        d.rotation.set(0, yaw, pitch * 0.5);
        d.scale.set(7, 0.6, 2.2);
        d.updateMatrix();
        im.setMatrixAt(n++, d.matrix);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    root.add(im);
    // a couple of impossible landing slabs floating at odd tilts
    for (let i = 0; i < 4; i++) {
      const m = slab(mats.dark, cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 24, cz + (Math.random() - 0.5) * 40, 12, 1, 12);
      m.rotation.set((Math.random() - 0.5) * 0.8, Math.random() * 6, (Math.random() - 0.5) * 0.8);
    }
  })();

  // ===================== Observation Void =====================
  // A balcony over an endless black drop: a parapet, tiny lights far below, and (built in
  // buildEntities) colossal shapes drifting through the dark.
  (function voidBalcony() {
    const z = Z.balcony;
    // parapet around the lip (three sides; the bridge continues forward)
    slab(mats.metal, 0, 1, z + 14, 60, 2, 1.4); // near rail
    slab(mats.metal, -30, 1, z - 8, 1.4, 2, 44); // left rail
    slab(mats.metal, 30, 1, z - 8, 1.4, 2, 44); // right rail
    // tiny lights drifting far below — like cities or stars
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1600;
      pos[i * 3 + 1] = -300 - Math.random() * 1400;
      pos[i * 3 + 2] = z - 200 - Math.random() * 1600;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9fb6c4, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    pts.frustumCulled = false;
    root.add(pts);
    handles.voidLights = { points: pts, pos, n, baseZ: z };
  })();

  // ===================== Breathing Archive =====================
  // Gigantic shelves / monolithic slabs that swell and contract almost imperceptibly,
  // like lungs. The space is sized for something far larger than a human.
  (function archive() {
    const z0 = Z.archive;
    for (let r = 0; r < 6; r++) {
      const side = r % 2 ? 1 : -1;
      const g = new THREE.Group();
      const gx = side * (24 + ((r / 2) | 0) * 26);
      const gz = z0 - ((r / 2) | 0) * 34;
      g.position.set(gx, 0, gz);
      // a towering shelf wall of huge cells (instanced blocks)
      const cols = 5;
      const rows = 7;
      const im = new THREE.InstancedMesh(BOX, pick([mats.mid, mats.dark, mats.pale]), cols * rows);
      im.frustumCulled = false;
      const d = new THREE.Object3D();
      let k = 0;
      for (let c = 0; c < cols; c++)
        for (let rr = 0; rr < rows; rr++) {
          d.position.set((c - cols / 2) * 7, 4 + rr * 7, 0);
          d.scale.set(6, 6, 5 + Math.random() * 3);
          d.updateMatrix();
          im.setMatrixAt(k++, d.matrix);
        }
      im.instanceMatrix.needsUpdate = true;
      g.add(im);
      root.add(g);
      handles.breathing.push({ group: g, rate: 0.18 + Math.random() * 0.22, phase: Math.random() * 6, amp: 0.012 + Math.random() * 0.012 });
    }
    // a few colossal "books"/slabs too big to use, leaning in the aisle
    for (let i = 0; i < 5; i++) {
      const m = slab(mats.stain, (Math.random() - 0.5) * 30, 14, z0 - 20 - Math.random() * 70, 3, 28, 18);
      m.rotation.z = (Math.random() - 0.5) * 0.3;
    }
  })();

  // ===================== Door Field =====================
  // Thousands of freestanding doors at every scale. Most are instanced dressing; a handful
  // are hand-built with uncanny interiors that the NonEuclideanDoorSystem reshuffles.
  (function doorField() {
    const z0 = Z.archive - 120;
    const N = C.doorField.instanced;
    const spread = C.doorField.spread;
    const leaves = new THREE.InstancedMesh(BOX, mats.dark, N);
    const frames = new THREE.InstancedMesh(BOX, mats.metal, N);
    leaves.frustumCulled = false;
    frames.frustumCulled = false;
    const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const s = Math.pow(2, Math.random() * 6); // 1 .. 64x — human-sized to skyscraper
      const x = (Math.random() - 0.5) * spread;
      const z = z0 - Math.random() * 260;
      const y = s * 1.05; // door height ~2.1 units * scale, standing on the floor
      const yaw = Math.random() * Math.PI * 2;
      d.position.set(x, y, z);
      d.rotation.set(0, yaw, 0);
      d.scale.set(s * 1.0, s * 2.1, s * 0.18);
      d.updateMatrix();
      leaves.setMatrixAt(i, d.matrix);
      d.scale.set(s * 1.3, s * 2.4, s * 0.1);
      d.updateMatrix();
      frames.setMatrixAt(i, d.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;
    frames.instanceMatrix.needsUpdate = true;
    root.add(frames);
    root.add(leaves);

    // special doors near the path, each with switchable interiors
    const kinds = ["nowhere", "tiny", "corridor", "loop", "wall", "light"];
    for (let i = 0; i < C.doorField.special; i++) {
      const g = new THREE.Group();
      const x = (i - (C.doorField.special - 1) / 2) * 9;
      g.position.set(x, 0, z0 - 8 - (i % 2) * 6);
      g.rotation.y = (Math.random() - 0.5) * 0.6;
      // frame + leaf (the leaf is what nudges)
      slab(mats.metal, -1.4, 2.1, 0, 0.4, 4.4, 0.5, g);
      slab(mats.metal, 1.4, 2.1, 0, 0.4, 4.4, 0.5, g);
      slab(mats.metal, 0, 4.4, 0, 3.2, 0.4, 0.5, g);
      const leaf = slab(mats.dark, 0.62, 2.05, 0.1, 1.16, 4.0, 0.12, g);
      leaf.geometry = BOX;
      // build three interiors behind the opening; show one
      const interiors = [];
      interiors.push(buildInterior("nowhere"));
      interiors.push(buildInterior(pick(["tiny", "corridor"])));
      interiors.push(buildInterior(pick(["loop", "light"])));
      interiors.forEach((node, j) => {
        node.position.z = -0.3;
        node.visible = j === 0;
        g.add(node);
      });
      root.add(g);
      const door = { group: g, leaf, interiors, shown: 0, baseRot: g.rotation.y, leafBase: 0, target: 0 };
      handles.doors.push(door);
      handles.interactives.push({ mesh: leaf, door, kind: "door" });
    }

    function buildInterior(kind) {
      const node = new THREE.Group();
      if (kind === "nowhere") {
        slab(mats.dark, 0, 2, -1, 2.4, 4.2, 0.4, node); // a black recess
      } else if (kind === "wall") {
        slab(mats.pale, 0, 2, -0.4, 2.6, 4.2, 0.4, node);
      } else if (kind === "tiny") {
        const room = new THREE.Group(); // a whole room, impossibly small, set deep
        slab(mats.mid, 0, 0.5, 0, 3, 0.1, 3, room);
        slab(mats.mid, 0, 1, -1.5, 3, 2, 0.1, room);
        slab(mats.dark, 0, 0.6, 0.8, 0.6, 1.2, 0.1, room); // a little door inside
        room.scale.setScalar(0.35);
        room.position.set(0, 1.0, -2.2);
        node.add(room);
      } else if (kind === "corridor") {
        const fr = new THREE.InstancedMesh(BOX, mats.metal, 10); // receding frames -> infinite
        fr.frustumCulled = false;
        const d2 = new THREE.Object3D();
        for (let k = 0; k < 10; k++) {
          const sc = 1 - k * 0.07;
          d2.position.set(0, 2.0, -1 - k * 1.4);
          d2.scale.set(2.4 * sc, 4.0 * sc, 0.12);
          d2.updateMatrix();
          fr.setMatrixAt(k, d2.matrix);
        }
        fr.instanceMatrix.needsUpdate = true;
        node.add(fr);
        node.add(glow(1.2, 3.2, 0x33404e, 0.4));
      } else if (kind === "loop") {
        const f = slab(mats.metal, 0, 2.0, -1, 2.0, 3.6, 0.2, node); // the same door, smaller
        f.scale.multiplyScalar(0.8);
        slab(mats.dark, 0, 2.0, -1.1, 1.0, 3.0, 0.1, node);
      } else {
        // light
        node.add(glow(2.0, 4.0, 0xf2f6ff, 0.8));
      }
      return node;
    }
  })();

  // ===================== Final Cathedral =====================
  // A colossal underground nave ending in a door ~300 m tall, not built for humans. A deep
  // slow heartbeat comes from behind it; it only ever opens a sliver.
  (function finalCathedral() {
    const z = Z.final;
    // nave walls + a high lintel framing the door
    slab(mats.dark, -90, 90, z + 90, 8, 180, 220);
    slab(mats.dark, 90, 90, z + 90, 8, 180, 220);
    slab(mats.dark, 0, 180, z + 90, 200, 8, 220); // roof, lost in the dark
    // the door: two leaves meeting at the centre line
    const H = 300;
    const W = 64;
    const left = slab(mats.mid, -W / 2 - 0.5, H / 2, z, W, H, 6);
    const right = slab(mats.mid, W / 2 + 0.5, H / 2, z, W, H, 6);
    slab(mats.metal, 0, H + 8, z, W * 2 + 30, 16, 8); // vast lintel
    // a thin bright leak in the seam + glow
    const leak = glow(1.2, H * 0.96, 0xeaf2ff, 0.9);
    leak.position.set(0, H / 2, z + 3.2);
    const halo = glow(40, H, 0xbcd6ff, 0.16);
    halo.position.set(0, H / 2, z + 4);
    handles.finalDoor = { left, right, leak, halo, z, leftX0: left.position.x, rightX0: right.position.x, crack: 3.0, opened: 0, openTarget: 0 };
    handles.interactives.push({ mesh: left, door: handles.finalDoor, kind: "final" });
    handles.interactives.push({ mesh: right, door: handles.finalDoor, kind: "final" });
  })();

  // ===================== lights + volumetric beams =====================
  (function lights() {
    root.add(new THREE.HemisphereLight(0x2a3340, 0x05060a, 0.35)); // cold, low base
    const addLamp = (x, y, z, color = C.light.cold, em = true) => {
      const light = new THREE.PointLight(color, C.light.lampIntensity, 60, 1.6);
      light.position.set(x, y, z);
      root.add(light);
      let tube = null;
      if (em) {
        tube = slab(new THREE.MeshStandardMaterial({ color: 0xf0f6ff, emissive: color, emissiveIntensity: 2.2 }), x, y + 1.5, z, 4, 0.25, 0.6);
        handles.lamps.push({ mesh: tube, base: 2.2 });
        // a faint volumetric beam under the tube
        const beam = new THREE.Mesh(
          new THREE.ConeGeometry(2.2, 10, 12, 1, true),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
        );
        beam.position.set(x, y - 3.5, z);
        root.add(beam);
      }
      handles.pointLights.push({ light, base: C.light.lampIntensity, color });
      return light;
    };
    addLamp(0, 18, -20); // arrival
    addLamp(0, C.corridor.height - 3, (Z.corrA + Z.corrB) / 2 + 30); // corridor near
    addLamp(0, C.corridor.height - 3, (Z.corrA + Z.corrB) / 2 - 50); // corridor far
    addLamp(0, 22, Z.archive - 30); // archive
    // a single emergency red near the stairwell — rare and wrong
    addLamp(18, 10, Z.stair, C.light.emergency, false).distance = 50;
  })();

  // ===================== hanging chains + suspended slabs =====================
  (function hazards() {
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const x = (Math.random() - 0.5) * 18;
      const z = (Z.corrA + Z.corrB) / 2 + (Math.random() - 0.5) * cl * 0.8;
      g.position.set(x, C.corridor.height - 2, z);
      const len = 6 + Math.random() * 8;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6), mats.metal);
      chain.position.y = -len / 2;
      g.add(chain);
      root.add(g);
      handles.chains.push({ group: g, rate: 0.4 + Math.random() * 0.7, phase: Math.random() * 6, amp: 0.04 + Math.random() * 0.05 });
    }
    // massive suspended slabs creaking overhead (cathedral + corridor)
    for (let i = 0; i < 4; i++) {
      const z = i < 2 ? (Z.corrA + Z.corrB) / 2 : Z.final + 60;
      const m = slab(mats.dark, (Math.random() - 0.5) * 40, 60 + Math.random() * 40, z + (Math.random() - 0.5) * 120, 20 + Math.random() * 30, 3, 20 + Math.random() * 30);
      handles.slabs.push({ mesh: m, baseY: m.position.y, rate: 0.1 + Math.random() * 0.2, phase: Math.random() * 6, amp: 0.4 + Math.random() * 0.6 });
    }
  })();

  // ===================== distant entities =====================
  (function entities() {
    const E = C.entity;
    // horizon silhouettes — barely-there giants, gone when stared at
    for (let i = 0; i < E.horizon; i++) {
      const g = new THREE.Group();
      const a = Math.random() * Math.PI * 2;
      const r = E.distance + Math.random() * 500;
      g.position.set(Math.cos(a) * r, 0, Z.balcony + Math.sin(a) * r);
      const mat = new THREE.MeshBasicMaterial({ color: 0x161b22, transparent: true, opacity: E.visible, fog: true });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat);
      body.scale.set(E.height * 0.4, E.height, E.height * 0.4);
      body.position.y = E.height * 0.5;
      g.add(body);
      root.add(g);
      handles.entities.push({ group: g, mat, kind: "horizon", angle: a, radius: r, opacity: E.visible, target: E.visible });
    }
    // void crossers — enormous shapes drifting through the abyss below the balcony
    for (let i = 0; i < E.voidCrossers; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x0e1117, transparent: true, opacity: 0.6, fog: true });
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat);
      const s = 220 + Math.random() * 380;
      body.scale.set(s, s * 1.6, s);
      body.position.set((Math.random() - 0.5) * 1200, -500 - Math.random() * 500, Z.balcony - 300 - Math.random() * 800);
      root.add(body);
      handles.entities.push({ mesh: body, mat, kind: "void", vx: (Math.random() < 0.5 ? 1 : -1) * E.drift, range: 1400 });
    }
  })();

  // ===================== threshold gates (fog targets per zone) =====================
  handles.gates = [
    { z: Z.corrA, zone: "corridor", fog: C.fog.corridor },
    { z: Z.corrB, zone: "stairwell", fog: C.fog.stairwell },
    { z: Z.stair - 30, zone: "balcony", fog: C.fog.balcony },
    { z: voidFar, zone: "archive", fog: C.fog.archive },
    { z: Z.archive - 90, zone: "doorField", fog: C.fog.doorField },
    { z: Z.door - 60, zone: "cathedral", fog: C.fog.cathedral },
  ];
  handles.Z = Z;
  handles.startZ = Z.arrival + 8;

  return handles;
}
