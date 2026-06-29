import * as THREE from "three";

// Floating VR tool menu. Left X toggles it; it appears in front of your gaze.
// Point the right-controller ray at an item and pull the trigger to select it
// (main routes the trigger here first via tryClick). The picked tool is what the grip uses.
export function createMenu({ scene, renderer, items, active, onSelect }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  let open = false;
  let activeId = active || (items[0] && items[0].id);

  const PANEL_W = 0.64;
  const BTN_H = 0.1;
  const GAP = 0.018;
  const TITLE_H = 0.08;
  const N = items.length;
  const stackH = N * BTN_H + (N - 1) * GAP;
  const totalH = TITLE_H + 0.04 + stackH;
  const top = totalH / 2;

  const COL_BASE = new THREE.Color(0x1a2238);
  const COL_HOVER = new THREE.Color(0x2c3f74);
  const COL_ACTIVE = new THREE.Color(0x3a5acc);

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_W + 0.06, totalH + 0.08),
    new THREE.MeshBasicMaterial({ color: 0x05060a, transparent: true, opacity: 0.82 }),
  );
  backdrop.position.z = -0.004;
  group.add(backdrop);

  const title = makeLabel("SELECT TOOL", PANEL_W, TITLE_H);
  title.position.set(0, top - TITLE_H / 2, 0.002);
  group.add(title);

  const buttons = []; // bg planes carrying userData.id
  items.forEach((it, i) => {
    const y = top - TITLE_H - 0.04 - i * (BTN_H + GAP) - BTN_H / 2;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(PANEL_W, BTN_H),
      new THREE.MeshBasicMaterial({
        color: COL_BASE.clone(),
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    bg.position.set(0, y, 0);
    bg.userData.id = it.id;
    group.add(bg);
    const label = makeLabel(it.label, PANEL_W - 0.04, BTN_H);
    label.position.set(0, y, 0.002);
    group.add(label);
    buttons.push(bg);
  });

  function paint(hoveredId) {
    for (const b of buttons) {
      const id = b.userData.id;
      b.material.color.copy(
        id === activeId ? COL_ACTIVE : id === hoveredId ? COL_HOVER : COL_BASE,
      );
    }
  }
  paint(null);

  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Matrix4();
  const _cp = new THREE.Vector3();
  const _cq = new THREE.Quaternion();
  const _cf = new THREE.Vector3();

  function pick(controller) {
    tmp.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmp);
    const hits = raycaster.intersectObjects(buttons, false);
    return hits.length ? hits[0].object : null;
  }

  function toggle() {
    open = !open;
    group.visible = open;
    if (open) {
      const cam = renderer.xr.getCamera();
      _cp.setFromMatrixPosition(cam.matrixWorld);
      _cq.setFromRotationMatrix(cam.matrixWorld);
      _cf.set(0, 0, -1).applyQuaternion(_cq).normalize();
      group.position.copy(_cp).addScaledVector(_cf, 1.4);
      group.quaternion.copy(_cq); // face the viewer
      paint(null);
    }
  }

  function update(controllers) {
    if (!open) return;
    let hovered = null;
    for (const c of controllers) {
      const h = pick(c);
      if (h) {
        hovered = h.userData.id;
        break;
      }
    }
    paint(hovered);
  }

  function tryClick(controller) {
    if (!open) return false;
    const h = pick(controller);
    if (!h) return false;
    activeId = h.userData.id;
    onSelect(activeId);
    open = false;
    group.visible = false;
    return true;
  }

  return {
    toggle,
    update,
    tryClick,
    get open() {
      return open;
    },
  };
}

function makeLabel(text, w, h) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#eaf0ff";
  ctx.font = "bold 60px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, h * 0.82),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
}
