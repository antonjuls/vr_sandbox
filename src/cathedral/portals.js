import * as THREE from "three";
import { CATHEDRAL } from "../config.js";

// Experimental portals. Two parts:
//  1) Seamless teleport — when your head crosses a portal's opening, the whole rig is moved
//     by the rigid transform that maps portal A onto portal B (mB · Ry180 · mA⁻¹). This is
//     true non-Euclidean traversal and is exact in VR (we move the dolly, tracking rides on
//     top). Doorway A and its linked doorway B can be anywhere — across the hall, or in a
//     room that does not fit.
//  2) A live "window" — each frame the destination is rendered (from a virtual camera placed
//     at your mirrored pose) into a render target shown on the portal surface, so you can see
//     through before you step. In stereo it's a mono approximation (one extra pass), gated to
//     the nearest portal and toggleable via CATHEDRAL.portal.window.
//
// Each portal: { group (Object3D at the opening centre, local +Z = front/approach side),
//                hw, hh (half opening), quad (the surface mesh), link (index of the partner) }.
export function createPortals(renderer, scene, camera, dolly, portals) {
  const P = CATHEDRAL.portal;
  const RY180 = new THREE.Matrix4().makeRotationY(Math.PI);
  const _inv = new THREE.Matrix4();
  const _xform = new THREE.Matrix4();
  const _mDolly = new THREE.Matrix4();
  const _mNew = new THREE.Matrix4();
  const _mHead = new THREE.Matrix4();
  const _local = new THREE.Vector3();
  const _head = new THREE.Vector3();
  const _scl = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);

  if (P.window) {
    for (const p of portals) {
      p.rt = new THREE.WebGLRenderTarget(P.rtSize, P.rtSize);
      p.vcam = new THREE.PerspectiveCamera(P.fov, 1, 0.1, 12000);
      if (p.quad) {
        p.quad.material.dispose?.();
        p.quad.material = new THREE.MeshBasicMaterial({ map: p.rt.texture, toneMapped: false, fog: false, side: THREE.DoubleSide });
      }
    }
  }
  portals.forEach((p) => (p.prev = 1)); // previous signed distance along the portal normal

  function headMatrix() {
    const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    _mHead.copy(cam.matrixWorld);
    return _mHead;
  }

  // portal transform A → B as a Matrix4
  function xformAtoB(a, b) {
    a.group.updateMatrixWorld();
    b.group.updateMatrixWorld();
    _inv.copy(a.group.matrixWorld).invert();
    return _xform.copy(b.group.matrixWorld).multiply(RY180).multiply(_inv);
  }

  function teleport(a, b) {
    xformAtoB(a, b);
    _mDolly.compose(dolly.position, dolly.quaternion, ONE);
    _mNew.multiplyMatrices(_xform, _mDolly);
    _mNew.decompose(dolly.position, dolly.quaternion, _scl);
    dolly.position.y = 0; // stay grounded
    portals.forEach((q) => (q.prev = 1)); // don't immediately re-trigger at the exit
  }

  // render the destination of portal p into its RT (a mono approximation in stereo)
  function renderWindow(p) {
    const b = portals[p.link];
    xformAtoB(p, b);
    _mNew.multiplyMatrices(_xform, headMatrix());
    _mNew.decompose(p.vcam.position, p.vcam.quaternion, _scl);
    p.vcam.updateMatrixWorld(true);

    const prevXr = renderer.xr.enabled;
    const prevTarget = renderer.getRenderTarget();
    renderer.xr.enabled = false; // render a normal mono view into the RT
    portals.forEach((q) => q.quad && (q.quad.visible = false)); // avoid portal-in-portal feedback
    const dollyShown = dolly.visible;
    dolly.visible = false; // don't render our own controllers/hands into the window
    try {
      renderer.setRenderTarget(p.rt);
      renderer.clear();
      renderer.render(scene, p.vcam);
    } finally {
      renderer.setRenderTarget(prevTarget);
      renderer.xr.enabled = prevXr;
      portals.forEach((q) => q.quad && (q.quad.visible = true));
      dolly.visible = dollyShown;
    }
  }

  function update() {
    const head = headMatrix();
    _head.setFromMatrixPosition(head);

    // crossing detection
    for (const p of portals) {
      p.group.updateMatrixWorld();
      _inv.copy(p.group.matrixWorld).invert();
      _local.copy(_head).applyMatrix4(_inv);
      const within = Math.abs(_local.x) < p.hw && _local.y > -p.hh - 0.3 && _local.y < p.hh + 0.3;
      const sd = _local.z;
      if (within && p.prev > 0 && sd <= 0) {
        teleport(p, portals[p.link]);
        return; // moved this frame; skip the rest
      }
      p.prev = within ? sd : 1;
    }

    // live window for the nearest portal in range
    if (P.window) {
      let near = null;
      let best = P.renderRange;
      for (const p of portals) {
        _local.setFromMatrixPosition(p.group.matrixWorld);
        const d = _local.distanceTo(_head);
        if (d < best) {
          best = d;
          near = p;
        }
      }
      if (near) renderWindow(near);
    }
  }

  return { update };
}
