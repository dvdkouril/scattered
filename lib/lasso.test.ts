import { describe, it, expect } from "vitest";
import { mat4, vec3 } from "gl-matrix";
import { projectPointToScreen, findPointsInLasso } from "./lasso";

// Helper: build typical camera matrices looking at the origin from +Z
function makeCamera(distance = 2) {
  const proj = mat4.create();
  mat4.perspectiveZO(proj, Math.PI / 4, 1, 0.1, 10);

  const view = mat4.create();
  const eye = vec3.fromValues(0, 0, distance);
  mat4.lookAt(view, eye, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));

  return { proj, view };
}

describe("projectPointToScreen", () => {
  it("projects the origin to roughly the center of the screen", () => {
    const { proj, view } = makeCamera();
    const w = 800, h = 600;
    const s = projectPointToScreen(0, 0, 0, proj, view, w, h, 1);
    expect(s.x).toBeCloseTo(w / 2, 0);
    expect(s.y).toBeCloseTo(h / 2, 0);
  });

  it("a point to the right in world space projects to the right on screen", () => {
    const { proj, view } = makeCamera();
    const w = 800, h = 600;
    const center = projectPointToScreen(0, 0, 0, proj, view, w, h, 1);
    const right = projectPointToScreen(0.5, 0, 0, proj, view, w, h, 1);
    expect(right.x).toBeGreaterThan(center.x);
  });

  it("respects positionsScale", () => {
    const { proj, view } = makeCamera();
    const w = 800, h = 600;
    const a = projectPointToScreen(1, 0, 0, proj, view, w, h, 0.5);
    const b = projectPointToScreen(0.5, 0, 0, proj, view, w, h, 1);
    expect(a.x).toBeCloseTo(b.x, 1);
    expect(a.y).toBeCloseTo(b.y, 1);
  });
});

describe("findPointsInLasso", () => {
  it("returns empty for a lasso with fewer than 3 vertices", () => {
    const { proj, view } = makeCamera();
    const x = new Float32Array([0]);
    const y = new Float32Array([0]);
    const z = new Float32Array([0]);

    expect(findPointsInLasso(x, y, z, proj, view, 800, 600, 1, [])).toEqual([]);
    expect(findPointsInLasso(x, y, z, proj, view, 800, 600, 1, [{ x: 0, y: 0 }])).toEqual([]);
    expect(findPointsInLasso(x, y, z, proj, view, 800, 600, 1, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([]);
  });

  it("selects a point at the origin when the lasso covers the screen center", () => {
    const { proj, view } = makeCamera();
    const w = 800, h = 600;
    const x = new Float32Array([0]);
    const y = new Float32Array([0]);
    const z = new Float32Array([0]);

    // Big rectangle around center
    const lasso = [
      { x: w / 2 - 50, y: h / 2 - 50 },
      { x: w / 2 + 50, y: h / 2 - 50 },
      { x: w / 2 + 50, y: h / 2 + 50 },
      { x: w / 2 - 50, y: h / 2 + 50 },
    ];
    expect(findPointsInLasso(x, y, z, proj, view, w, h, 1, lasso)).toEqual([0]);
  });

  it("does not select a point outside the lasso", () => {
    const { proj, view } = makeCamera();
    const w = 800, h = 600;
    const x = new Float32Array([0]);
    const y = new Float32Array([0]);
    const z = new Float32Array([0]);

    // Small rectangle in the top-left corner — far from center
    const lasso = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ];
    expect(findPointsInLasso(x, y, z, proj, view, w, h, 1, lasso)).toEqual([]);
  });

  it("selects the correct subset of multiple points", () => {
    const { proj, view } = makeCamera(3);
    const w = 800, h = 600;

    // 5 points along the x axis
    const x = new Float32Array([-0.4, -0.2, 0, 0.2, 0.4]);
    const y = new Float32Array([0, 0, 0, 0, 0]);
    const z = new Float32Array([0, 0, 0, 0, 0]);

    // Project each to know where they land
    const screenXs = Array.from(x).map(
      (xi) => projectPointToScreen(xi, 0, 0, proj, view, w, h, 1).x,
    );

    // Build a lasso that captures only points with negative x (left of center)
    const midX = w / 2;
    const lasso = [
      { x: 0, y: 0 },
      { x: midX - 1, y: 0 },
      { x: midX - 1, y: h },
      { x: 0, y: h },
    ];

    const result = findPointsInLasso(x, y, z, proj, view, w, h, 1, lasso);
    // Points at index 0 and 1 have negative x → project left of center
    expect(screenXs[0]).toBeLessThan(midX);
    expect(screenXs[1]).toBeLessThan(midX);
    expect(result).toEqual([0, 1]);
  });

  it("selects all points when lasso covers the entire screen", () => {
    const { proj, view } = makeCamera();
    const w = 800, h = 600;
    const x = new Float32Array([0, 0.1, -0.1]);
    const y = new Float32Array([0, 0.1, -0.1]);
    const z = new Float32Array([0, 0, 0]);

    const lasso = [
      { x: -1, y: -1 },
      { x: w + 1, y: -1 },
      { x: w + 1, y: h + 1 },
      { x: -1, y: h + 1 },
    ];

    expect(findPointsInLasso(x, y, z, proj, view, w, h, 1, lasso)).toEqual([0, 1, 2]);
  });
});
