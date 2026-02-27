import { describe, it, expect } from 'vitest';
import { tableFromArrays, tableToIPC } from '@uwdata/flechette';
import { display, mapValuesToColors } from './main.ts';

// --- color mapping ---

describe('mapValuesToColors', () => {
  it('outputs 4 floats per value for qualitative (string) data', () => {
    const result = mapValuesToColors(['A', 'B', 'C']);
    expect(result.length).toBe(3 * 4);
  });

  it('outputs 4 floats per value for quantitative Float64Array', () => {
    const result = mapValuesToColors(new Float64Array([0, 0.5, 1]));
    expect(result.length).toBe(3 * 4);
  });

  it('outputs 4 floats per value for quantitative number[]', () => {
    const result = mapValuesToColors([0, 0.5, 1]);
    expect(result.length).toBe(3 * 4);
  });

  it('qualitative and quantitative outputs have consistent RGBA format', () => {
    const n = 5;
    const qual  = mapValuesToColors(['A', 'B', 'C', 'D', 'E']);
    const quant = mapValuesToColors(new Float64Array([0, 0.25, 0.5, 0.75, 1]));
    expect(qual.length).toBe(n * 4);
    expect(quant.length).toBe(n * 4);
  });

  it('does not crash when there are more unique values than palette entries', () => {
    const values = Array.from({ length: 20 }, (_, i) => `cat_${i}`);
    expect(() => mapValuesToColors(values, ['red', 'blue', 'green'])).not.toThrow();
    expect(mapValuesToColors(values, ['red', 'blue', 'green']).length).toBe(20 * 4);
  });
});

// --- display / arrow processing ---

function makeArrowBuffer(data: Record<string, number[]>): ArrayBuffer {
  const table = tableFromArrays(data);
  return tableToIPC(table, {})!.buffer;
}

describe('display', () => {
  it('returns a canvas element and a destroy function', () => {
    const buf = makeArrowBuffer({ x: [1, 2, 3], y: [4, 5, 6], z: [7, 8, 9] });
    const { canvas, destroy } = display(buf);
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(destroy).toBeTypeOf('function');
  });

  it('throws a clear error for an unknown position field', () => {
    const buf = makeArrowBuffer({ x: [1, 2], y: [3, 4], z: [5, 6] });
    expect(() => display(buf, { x: 'wrong_field' }))
      .toThrow(/wrong_field/);
    expect(() => display(buf, { x: 'wrong_field' }))
      .toThrow(/Available fields/);
  });

  it('throws a clear error for an unknown color field', () => {
    const buf = makeArrowBuffer({ x: [1, 2], y: [3, 4], z: [5, 6] });
    expect(() => display(buf, { color: 'nonexistent' }))
      .toThrow(/nonexistent/);
  });
});
