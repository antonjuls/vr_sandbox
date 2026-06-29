import * as CANNON from "cannon-es";
import {
  GRAVITY,
  RESTITUTION,
  FRICTION,
  LINEAR_DAMPING,
  ANGULAR_DAMPING,
  THROW_SCALE,
  MAX_THROW,
  FIXED_STEP,
  MAX_SUBSTEPS,
} from "./config.js";

// Wrapper around cannon-es: the physics world, bodies, sync with three meshes and grabbing.
// Each grabbable maps to a body; the mesh<->body link is kept in the links array.
// Meshes are NOT reparented on grab (unlike before) — the shape's body becomes kinematic and
// follows the controller, while the mesh always mirrors the body. That keeps the visual and
// the collider from drifting apart.
export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
  world.allowSleep = true; // sleeping shapes don't jitter and don't burn CPU

  // single material: set friction/restitution once for all contacts
  const material = new CANNON.Material("surface");
  const contact = new CANNON.ContactMaterial(material, material, {
    friction: FRICTION,
    restitution: RESTITUTION,
  });
  world.addContactMaterial(contact);
  world.defaultContactMaterial.friction = FRICTION;
  world.defaultContactMaterial.restitution = RESTITUTION;

  // floor — infinite plane, normal pointing up
  const floor = new CANNON.Body({ type: CANNON.Body.STATIC, material });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  const links = []; // { mesh, body }
  const held = new Map(); // mesh -> { prevPos, prevQuat, vel, angVel }

  function makeShape(desc) {
    if (desc.kind === "box") {
      return new CANNON.Box(
        new CANNON.Vec3(desc.half[0], desc.half[1], desc.half[2]),
      );
    }
    return new CANNON.Sphere(desc.radius);
  }

  // dynamic body for a grabbable shape (shape comes from mesh.userData.body)
  function addGrabbable(mesh) {
    const desc = mesh.userData.body;
    const body = new CANNON.Body({
      mass: desc.mass,
      material,
      linearDamping: LINEAR_DAMPING,
      angularDamping: ANGULAR_DAMPING,
    });
    body.addShape(makeShape(desc));
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(
      mesh.quaternion.x,
      mesh.quaternion.y,
      mesh.quaternion.z,
      mesh.quaternion.w,
    );
    world.addBody(body);
    mesh.userData.body3d = body;
    links.push({ mesh, body });
  }

  // static column obstacle (cannon-es cylinder runs along Y — same as three)
  function addColumn(col) {
    const body = new CANNON.Body({ type: CANNON.Body.STATIC, material });
    body.addShape(new CANNON.Cylinder(col.radius, col.radius, col.height, 10));
    body.position.set(
      col.mesh.position.x,
      col.mesh.position.y,
      col.mesh.position.z,
    );
    world.addBody(body);
  }

  // ---------- grab ----------
  function beginGrab(mesh) {
    const body = mesh.userData.body3d;
    body.type = CANNON.Body.KINEMATIC;
    body.updateMassProperties();
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.wakeUp();
    mesh.userData.held = true;
    held.set(mesh, {
      prevPos: new CANNON.Vec3(body.position.x, body.position.y, body.position.z),
      prevQuat: new CANNON.Quaternion(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      ),
      vel: new CANNON.Vec3(),
      angVel: new CANNON.Vec3(),
    });
  }

  // Call every frame for the held shape: drive the body by the controller and accumulate
  // hand velocity (pos/quat — the controller's world position and orientation).
  function updateHeld(mesh, pos, quat, dt) {
    const body = mesh.userData.body3d;
    const d = held.get(mesh);
    if (!d) return;
    const inv = 1 / Math.max(dt, 1e-4);

    // linear hand velocity
    d.vel.set(
      (pos.x - d.prevPos.x) * inv,
      (pos.y - d.prevPos.y) * inv,
      (pos.z - d.prevPos.z) * inv,
    );
    // angular hand velocity from the quaternion delta: dq = cur * conj(prev)
    angularFromDelta(d.angVel, d.prevQuat, quat, inv);

    // drive the body: teleport onto the hand + set velocity (so it pushes other shapes).
    // The body lags at most one frame of motion — imperceptible in VR.
    body.position.set(pos.x, pos.y, pos.z);
    body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    body.velocity.copy(d.vel);
    body.angularVelocity.copy(d.angVel);

    d.prevPos.set(pos.x, pos.y, pos.z);
    d.prevQuat.set(quat.x, quat.y, quat.z, quat.w);
  }

  function endGrab(mesh) {
    const body = mesh.userData.body3d;
    const d = held.get(mesh);
    body.type = CANNON.Body.DYNAMIC;
    body.updateMassProperties();
    body.wakeUp();
    if (d) {
      // throw: the shape flies off with the hand velocity (scaled and capped)
      let vx = d.vel.x * THROW_SCALE,
        vy = d.vel.y * THROW_SCALE,
        vz = d.vel.z * THROW_SCALE;
      const sp = Math.hypot(vx, vy, vz);
      if (sp > MAX_THROW) {
        const k = MAX_THROW / sp;
        vx *= k;
        vy *= k;
        vz *= k;
      }
      body.velocity.set(vx, vy, vz);
      body.angularVelocity.copy(d.angVel);
      held.delete(mesh);
    }
    mesh.userData.held = false;
  }

  // simulation step + copy body transforms onto meshes
  function step(dt) {
    world.step(FIXED_STEP, dt, MAX_SUBSTEPS);
    for (const { mesh, body } of links) {
      mesh.position.set(body.position.x, body.position.y, body.position.z);
      mesh.quaternion.set(
        body.quaternion.x,
        body.quaternion.y,
        body.quaternion.z,
        body.quaternion.w,
      );
    }
  }

  // remove a shape's body from the world and the links list (caller removes the mesh)
  function remove(mesh) {
    const body = mesh.userData.body3d;
    if (!body) return;
    world.removeBody(body);
    const i = links.findIndex((l) => l.mesh === mesh);
    if (i >= 0) links.splice(i, 1);
    held.delete(mesh);
    mesh.userData.body3d = undefined;
  }

  // run cb(body, mesh) for every dynamic, non-held shape (for force fields).
  // cb must not add/remove bodies — collect and mutate after the loop.
  function eachDynamic(cb) {
    for (const { mesh, body } of links) {
      if (mesh.userData.held) continue;
      if (body.type !== CANNON.Body.DYNAMIC) continue;
      cb(body, mesh);
    }
  }

  return {
    world,
    addGrabbable,
    addColumn,
    beginGrab,
    updateHeld,
    endGrab,
    step,
    remove,
    eachDynamic,
  };
}

// Angular velocity from the difference of two quaternions (out, prev, cur — cannon.Quaternion).
// dq = cur * conj(prev); then axis-angle divided by dt. Accurate for small per-frame rotations.
function angularFromDelta(out, prev, cur, inv) {
  const px = -prev.x,
    py = -prev.y,
    pz = -prev.z,
    pw = prev.w; // conj(prev)
  // Hamilton product cur * conj(prev)
  const x = cur.w * px + cur.x * pw + cur.y * pz - cur.z * py;
  const y = cur.w * py - cur.x * pz + cur.y * pw + cur.z * px;
  const z = cur.w * pz + cur.x * py - cur.y * px + cur.z * pw;
  let w = cur.w * pw - cur.x * px - cur.y * py - cur.z * pz;
  if (w > 1) w = 1;
  if (w < -1) w = -1;
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-4) {
    out.setZero();
    return;
  }
  let angle = 2 * Math.acos(w);
  if (angle > Math.PI) angle -= 2 * Math.PI; // shortest arc
  const k = (angle * inv) / s;
  out.set(x * k, y * k, z * k);
}
