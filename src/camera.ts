import { vec2, vec3 } from "gl-matrix";

/* Loosely inspired by https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/OrbitControls.js
 * ...but worse. */
export class Camera {
  #dragStartPos: vec2 = vec2.fromValues(0, 0);
  #dragging: boolean = false;

  #angle = 0;
  #radius = 2;
  #speed = 0.01;

  constructor(angle: number = 0, radius: number = 2) {
    this.#dragStartPos = vec2.fromValues(0, 0);
    this.#angle = angle;
    this.#radius = radius;
  }

  getPosition(): vec3 {
    const camX = Math.cos(this.#angle) * this.#radius;
    const camZ = Math.sin(this.#angle) * this.#radius;
    const cameraPosition = vec3.fromValues(camX, 0, camZ);
    return cameraPosition;
  }

  onPointerDown(event: PointerEvent) {
    this.#dragStartPos = vec2.fromValues(event.clientX, event.clientY);
    this.#dragging = true;
  }

  onPointerUp(_: PointerEvent) {
    this.#dragging = false;
  }

  onMouseMove(event: MouseEvent) {
    console.log(`${event.clientX}, ${event.clientY}`);
    if (!this.#dragging) {
      return;
    }

    const endPos = vec2.fromValues(event.clientX, event.clientY);
    const delta = vec2.fromValues(0, 0);
    vec2.sub(delta, endPos, this.#dragStartPos);
    this.#angle += delta[0] * this.#speed * Math.PI / 12;

    this.#dragStartPos = vec2.fromValues(event.clientX, event.clientY);
  }
};
