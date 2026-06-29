// Shared XR gamepad helpers (used by locomotion and effects).

export function getPads(renderer) {
  let left = null;
  let right = null;
  const s = renderer.xr.getSession();
  if (s) {
    for (const src of s.inputSources) {
      if (!src.gamepad) continue;
      if (src.handedness === "left") left = src.gamepad;
      else if (src.handedness === "right") right = src.gamepad;
    }
  }
  return { left, right };
}

export function thumb(gp) {
  if (!gp) return { x: 0, y: 0 };
  const a = gp.axes;
  if (a.length >= 4) return { x: a[2], y: a[3] }; // on Quest the stick is axes 2/3
  if (a.length >= 2) return { x: a[0], y: a[1] };
  return { x: 0, y: 0 };
}

export function button(gp, i) {
  return !!(gp && gp.buttons && gp.buttons[i] && gp.buttons[i].pressed);
}
