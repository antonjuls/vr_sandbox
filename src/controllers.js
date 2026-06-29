import * as THREE from "three";
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory.js";
import { XRHandModelFactory } from "three/addons/webxr/XRHandModelFactory.js";

// Controllers + hands + pointer ray. Everything is parented to dolly (the player rig).
// select events fire from both the controller trigger and the hand pinch → grabbing works with both.
export function setupControllers(renderer, dolly, onSelectStart, onSelectEnd) {
  const ctrlFactory = new XRControllerModelFactory();
  const handFactory = new XRHandModelFactory();

  const buildRay = () => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0x88aaff }),
    );
    line.scale.z = 1.2;
    return line;
  };

  const controllers = [];
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.add(buildRay());
    controller.addEventListener("selectstart", onSelectStart);
    controller.addEventListener("selectend", onSelectEnd);
    // remember which hand this is (left/right) — scenes route input by handedness
    controller.addEventListener("connected", (e) => {
      controller.userData.handedness = e.data && e.data.handedness;
    });
    controller.addEventListener("disconnected", () => {
      controller.userData.handedness = null;
    });
    dolly.add(controller);
    controllers.push(controller);

    // Quest controller model
    const grip = renderer.xr.getControllerGrip(i);
    grip.add(ctrlFactory.createControllerModel(grip));
    dolly.add(grip);

    // hand model (sphere primitives, no external assets to load)
    const hand = renderer.xr.getHand(i);
    hand.add(handFactory.createHandModel(hand, "spheres"));
    dolly.add(hand);
  }
  return controllers;
}
