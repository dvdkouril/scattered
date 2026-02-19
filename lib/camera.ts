import { vec2, vec3 } from "gl-matrix";

const PHI_MIN = 0.01;
const PHI_MAX = Math.PI - 0.01;
const ROTATION_SPEED = 0.01;

/* Loosely inspired by https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/OrbitControls.js
 * ...but worse. */
export class Camera {
  #dragStartPos: vec2 = vec2.fromValues(0, 0);
  #dragging: boolean = false;

  #theta = 0;        // azimuth angle (horizontal)
  #phi = Math.PI / 2; // polar angle (vertical), PI/2 = equator
  #radius = 2;

  constructor(theta: number = 0, radius: number = 2, phi: number = Math.PI / 2) {
    this.#theta = theta;
    this.#phi = phi;
    this.#radius = radius;
  }

  getPosition(): vec3 {
    const x = this.#radius * Math.cos(this.#theta) * Math.sin(this.#phi);
    const y = this.#radius * Math.cos(this.#phi);
    const z = this.#radius * Math.sin(this.#theta) * Math.sin(this.#phi);
    return vec3.fromValues(x, y, z);
  }

  onPointerDown(event: PointerEvent) {
    this.#dragStartPos = vec2.fromValues(event.clientX, event.clientY);
    this.#dragging = true;
  }

  onPointerUp(_: PointerEvent) {
    this.#dragging = false;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.#dragging) {
      return;
    }

    const endPos = vec2.fromValues(event.clientX, event.clientY);
    const delta = vec2.sub(vec2.create(), endPos, this.#dragStartPos);

    this.#theta += delta[0] * ROTATION_SPEED * Math.PI / 12;
    this.#phi  -= delta[1] * ROTATION_SPEED * Math.PI / 12;
    this.#phi   = Math.max(PHI_MIN, Math.min(PHI_MAX, this.#phi));

    this.#dragStartPos = vec2.fromValues(event.clientX, event.clientY);
  }

  onWheel(event: WheelEvent) {
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16;  // lines → pixels
    if (event.deltaMode === 2) delta *= 800; // pages → pixels
    this.#radius += delta * 0.01;
    this.#radius = Math.max(0.1, this.#radius);
  }

  get theta() { return this.#theta; }
  get phi()   { return this.#phi; }
};
