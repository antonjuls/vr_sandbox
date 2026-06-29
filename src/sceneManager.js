// Named-scene manager. Each scene is a self-contained world (its own THREE.Scene,
// content, rules and update loop). Scenes are built lazily on first selection and then
// cached, so switching back keeps a scene's state. The shared player rig (dolly) is
// moved into whichever scene is active.
export function createSceneManager(ctx, registry) {
  const built = new Map(); // id → scene instance
  let active = null;

  function list() {
    return registry.map((r) => ({ id: r.id, name: r.name }));
  }

  function get(id) {
    if (!built.has(id)) {
      const def = registry.find((r) => r.id === id);
      if (!def) throw new Error("unknown scene: " + id);
      built.set(id, def.create(ctx));
    }
    return built.get(id);
  }

  function switchTo(id) {
    const next = get(id);
    if (next === active) return;
    if (active) {
      if (active.onDeactivate) active.onDeactivate();
      active.scene.remove(ctx.dolly);
    }
    active = next;
    active.scene.add(ctx.dolly);
    if (active.onActivate) active.onActivate();
  }

  return {
    list,
    switchTo,
    get active() {
      return active;
    },
  };
}
