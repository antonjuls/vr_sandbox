// Lightweight player collision for The Threshold Cathedral. The world is (almost) all
// axis-aligned concrete boxes, so we resolve the player as a vertical circle in the XZ
// plane against a list of AABBs — cheap, predictable, and enough to stop you walking
// through walls or off the bridge. (No cannon-es: this is a grounded walking scene; the
// floor clamp lives in locomotion.)
export function createCollision(colliders, opts = {}) {
  const r = opts.radius ?? 0.4;
  const passes = opts.passes ?? 2;

  // resolve the point (px,pz) out of every box; returns the corrected {x,z}
  function resolve(px, pz) {
    let x = px;
    let z = pz;
    for (let p = 0; p < passes; p++) {
      for (const b of colliders) {
        const cx = x < b.minX ? b.minX : x > b.maxX ? b.maxX : x;
        const cz = z < b.minZ ? b.minZ : z > b.maxZ ? b.maxZ : z;
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = r - d;
          x += (dx / d) * push;
          z += (dz / d) * push;
        } else {
          // centre inside the box → push out along the shallowest face
          const toMinX = x - b.minX;
          const toMaxX = b.maxX - x;
          const toMinZ = z - b.minZ;
          const toMaxZ = b.maxZ - z;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) x = b.minX - r;
          else if (m === toMaxX) x = b.maxX + r;
          else if (m === toMinZ) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  return { resolve };
}
