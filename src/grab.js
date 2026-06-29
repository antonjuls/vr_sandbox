import * as THREE from "three";

// Grab shapes with a ray from the controller/hand. The held shape's transform is
// computed by physics (its body becomes kinematic); here we only pick the target,
// highlight it, and feed the controller's world pose into physics.updateHeld each frame.
export function createGrab(grabbables, physics) {
  const raycaster = new THREE.Raycaster();
  const tmpMatrix = new THREE.Matrix4();
  const heldBy = new Map(); // controller → mesh
  const hovered = new Set();

  // temporaries (no per-frame allocations)
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scl = new THREE.Vector3();

  function getIntersections(controller) {
    tmpMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpMatrix);
    return raycaster.intersectObjects(grabbables, false);
  }

  function onSelectStart(e) {
    const controller = e.target;
    if (heldBy.has(controller)) return;
    const hits = getIntersections(controller);
    if (!hits.length) return;
    const mesh = hits[0].object;
    if (mesh.userData.held) return; // already held by the other hand
    mesh.material.emissiveIntensity = 0.5;
    physics.beginGrab(mesh);
    heldBy.set(controller, mesh);
  }

  function onSelectEnd(e) {
    const controller = e.target;
    const mesh = heldBy.get(controller);
    if (!mesh) return;
    mesh.material.emissiveIntensity = mesh.userData.baseEmissive;
    physics.endGrab(mesh); // physics computes the throw from hand velocity
    heldBy.delete(controller);
  }

  // drive held shapes by their controllers every frame
  function updateHeld(dt) {
    for (const [controller, mesh] of heldBy) {
      controller.updateWorldMatrix(true, false);
      controller.matrixWorld.decompose(_pos, _quat, _scl);
      physics.updateHeld(mesh, _pos, _quat, dt);
    }
  }

  // ray hover highlight
  function updateHover(controllers) {
    hovered.forEach((m) => {
      if (!m.userData.held) m.material.emissiveIntensity = m.userData.baseEmissive;
    });
    hovered.clear();
    for (const c of controllers) {
      if (heldBy.has(c)) continue;
      const hits = getIntersections(c);
      if (!hits.length) continue;
      const m = hits[0].object;
      if (!m.userData.held) {
        m.material.emissiveIntensity = 0.4;
        hovered.add(m);
      }
    }
  }

  return { onSelectStart, onSelectEnd, updateHeld, updateHover };
}
