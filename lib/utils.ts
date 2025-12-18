import { vec3, mat4 } from "gl-matrix";

export function prepareCameraMatrix(width: number, height: number): mat4 {

  const projMat = mat4.create();
  const fovy = Math.PI / 4.0;
  const near = 0.1;
  const far = 10.0;
  const aspect = width / height;
  // https://github.com/toji/gl-matrix/pull/413
  mat4.perspectiveZO(projMat, fovy, aspect, near, far);

  return projMat;
}

export function prepareViewMatrix(eye: vec3): mat4 {
  const viewMat = mat4.create();

  const center = vec3.fromValues(0, 0, 0);
  const up = vec3.fromValues(0, 1, 0);
  mat4.lookAt(viewMat, eye, center, up);

  return viewMat;
}

export function generateRandomPoints(n: number): number[] {
  const res: number[] = [];
  for (let i = 0; i < n; i++) {
    res.push(rand(), rand(), rand(), 1);
  }
  return res;
}

function rand(min?: number, max?: number): number {
  if (min === undefined) {
    min = 0;
    max = 1;
  } else if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
}

export function hexColorToFloatArray(color: string): number[] {
  // remove leading #
  color = color.replace(/^#/, '');

  // handle short form "#RGB"
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }

  const int = parseInt(color, 16);

  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;

  return [r, g, b].map(v => v / 255);
}
