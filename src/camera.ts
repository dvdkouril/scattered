import { vec2 } from "gl-matrix";

export class Camera {
  #dragStartPos: vec2 = vec2.fromValues(0, 0);

  constructor() {
    this.#dragStartPos = vec2.fromValues(0, 0);
  }

  onPointerDown(event: PointerEvent) {
    console.log("pointer down.");
    this.#dragStartPos = vec2.fromValues(event.clientX, event.clientY);
  }

  onPointerUp(event: PointerEvent) {
    console.log("pointer up.");
    const endPos = vec2.fromValues(event.clientX, event.clientY);
    const delta = vec2.fromValues(0, 0);
    vec2.sub(delta, endPos, this.#dragStartPos);
  }

  onMouseMove(event: MouseEvent) {
    console.log(`${event.clientX}, ${event.clientY}`);
  }
};
