import { vec3 } from "gl-matrix";

const PHI_MIN = 0.01;
const PHI_MAX = Math.PI - 0.01;
const ROTATION_SPEED = 0.01;
const PAN_SPEED = 0.0005;

/* Loosely inspired by https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/OrbitControls.js
 * ...but worse. */
export class Camera {
  #dragging: boolean = false;
  #panning: boolean = false;

  #theta = 0;        // azimuth angle (horizontal)
  #phi = Math.PI / 2; // polar angle (vertical), PI/2 = equator
  #radius = 2;
  #target: vec3 = vec3.fromValues(0, 0, 0);

  constructor(theta: number = 0, radius: number = 2, phi: number = Math.PI / 2) {
    this.#theta = theta;
    this.#phi = phi;
    this.#radius = radius;
  }

  getPosition(): vec3 {
    const x = this.#radius * Math.cos(this.#theta) * Math.sin(this.#phi);
    const y = this.#radius * Math.cos(this.#phi);
    const z = this.#radius * Math.sin(this.#theta) * Math.sin(this.#phi);
    return vec3.fromValues(
      x + this.#target[0],
      y + this.#target[1],
      z + this.#target[2],
    );
  }

  get target(): vec3 {
    return vec3.clone(this.#target);
  }

  onPointerDown(event: PointerEvent) {
    if (event.button === 2) {
      this.#panning = true;
    } else {
      this.#dragging = true;
    }
  }

  onPointerUp(_: PointerEvent) {
    this.#dragging = false;
    this.#panning = false;
  }

  onMouseMove(event: MouseEvent) {
    if (this.#panning) {
      // Compute camera right and up vectors in world space
      const eye = this.getPosition();
      const forward = vec3.create();
      vec3.subtract(forward, this.#target, eye);
      vec3.normalize(forward, forward);

      const worldUp = vec3.fromValues(0, 1, 0);
      const right = vec3.create();
      vec3.cross(right, forward, worldUp);
      vec3.normalize(right, right);

      const up = vec3.create();
      vec3.cross(up, right, forward);
      vec3.normalize(up, up);

      // Translate target in the camera's local right/up plane
      const panScale = PAN_SPEED * this.#radius;
      const dx = -event.movementX * panScale;
      const dy = event.movementY * panScale;

      this.#target[0] += right[0] * dx + up[0] * dy;
      this.#target[1] += right[1] * dx + up[1] * dy;
      this.#target[2] += right[2] * dx + up[2] * dy;
      return;
    }

    if (!this.#dragging) {
      return;
    }

    this.#theta += event.movementX * ROTATION_SPEED * Math.PI / 12;
    this.#phi  -= event.movementY * ROTATION_SPEED * Math.PI / 12;
    this.#phi   = Math.max(PHI_MIN, Math.min(PHI_MAX, this.#phi));
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
