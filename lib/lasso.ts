import { mat4, vec4 } from "gl-matrix";

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Project a 3D point to 2D screen coordinates using the same transform as the
 * GPU shader: clip = projection * view * vec4(x*scale, y*scale, z*scale, 1).
 */
export function projectPointToScreen(
  x: number,
  y: number,
  z: number,
  projectionMatrix: mat4,
  viewMatrix: mat4,
  canvasWidth: number,
  canvasHeight: number,
  positionsScale: number,
): ScreenPoint {
  const worldPos = vec4.fromValues(
    x * positionsScale,
    y * positionsScale,
    z * positionsScale,
    1.0,
  );

  // view * worldPos
  const viewPos = vec4.create();
  vec4.transformMat4(viewPos, worldPos, viewMatrix);

  // projection * viewPos
  const clip = vec4.create();
  vec4.transformMat4(clip, viewPos, projectionMatrix);

  // perspective divide
  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];

  // NDC → screen
  const sx = (ndcX + 1) * 0.5 * canvasWidth;
  const sy = (1 - ndcY) * 0.5 * canvasHeight;

  return { x: sx, y: sy };
}

/**
 * Ray-casting point-in-polygon test.
 * Returns true if (px, py) is inside the polygon defined by `polygon`.
 */
function pointInPolygon(px: number, py: number, polygon: ScreenPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Given arrays of 3D point positions, camera matrices, and a lasso polygon in
 * screen coordinates, return the indices of all points that project inside the
 * lasso.
 */
export function findPointsInLasso(
  xArr: ArrayLike<number>,
  yArr: ArrayLike<number>,
  zArr: ArrayLike<number>,
  projectionMatrix: mat4,
  viewMatrix: mat4,
  canvasWidth: number,
  canvasHeight: number,
  positionsScale: number,
  lassoPath: ScreenPoint[],
): number[] {
  if (lassoPath.length < 3) return [];

  const selected: number[] = [];
  const n = xArr.length;

  for (let i = 0; i < n; i++) {
    const screen = projectPointToScreen(
      xArr[i],
      yArr[i],
      zArr[i],
      projectionMatrix,
      viewMatrix,
      canvasWidth,
      canvasHeight,
      positionsScale,
    );
    if (pointInPolygon(screen.x, screen.y, lassoPath)) {
      selected.push(i);
    }
  }

  return selected;
}
