import { loadDataFromURL } from "./loaders.ts";
import { initWebGPUStuff } from "./renderer.ts";
import { tableFromIPC } from "@uwdata/flechette";
import { DisplayOptions, DisplayResult, Encoding } from "./types.ts";
import { assert } from "./assert.ts";
import chroma from "chroma-js";
import type { Color as ChromaColor } from "chroma-js";
import { isBrewerPaletteName, showCanvasError } from "./utils.ts";

function arrayMaxAbs(arr: Float32Array): number {
  let max = 0;
  for (let i = 0; i < arr.length; i++) {
    const abs = Math.abs(arr[i]);
    if (abs > max) max = abs;
  }
  return max;
}

function computeScaleFactor(xArr: Float32Array, yArr: Float32Array, zArr: Float32Array): number {
  const maxAbs = Math.max(arrayMaxAbs(xArr), arrayMaxAbs(yArr), arrayMaxAbs(zArr));
  return maxAbs > 0 ? 1.0 / maxAbs : 1.0;
}

function processArrow(b: ArrayBuffer, xField?: string, yField?: string, zField?: string, colorField?: string): [Float32Array, Float32Array, Float32Array, Float32Array, number] {
  const table = tableFromIPC(b);
  console.log("loaded table: ");
  console.log(table.schema);

  const columns = table.toColumns();
  //~ By default, look for "x", "y", "z" fields, but use other fields if specified
  const xKey = xField ? xField : "x";
  const yKey = yField ? yField : "y";
  const zKey = zField ? zField : "z";
  // Convert to Float32Array since shader expects f32, not f64
  // flechette outputs Float type column to `number[]` which is 64-bit float
  const xArr = new Float32Array(columns[xKey]);
  const yArr = new Float32Array(columns[yKey]);
  const zArr = new Float32Array(columns[zKey]);
  const positionsScale = computeScaleFactor(xArr, yArr, zArr);

  /*
   * If the `colorField` is specified, this means that we want to grab that column and:
   * - figure out whether the values are qualitative or quantitative
   * - if qualitative, we need to transform the values into numerical representation (via a lookup table)
   * - if quantitative, we can just use that for the color mapping
   */
  if (colorField) {
    const colorColumn = table.getChild(colorField);
    assert(colorColumn, `field ${colorField} not found in table (trying to map to color)`);
    const colorArr = Array.from(colorColumn.toArray());
    const colorsBuffer = mapValuesToColors(colorArr);
    return [xArr, yArr, zArr, colorsBuffer, positionsScale];
  }

  //~ if the colorField is not specified, build the buffer with a default color
  const defaultColors = new Float32Array(xArr.length * 4);
  const defaultColor = chroma("crimson");
  const col = defaultColor.gl();

  for (let i = 0; i < defaultColors.length; i += 4) {
    defaultColors.set(col, i);
  }

  return [xArr, yArr, zArr, defaultColors, positionsScale];
}

/*
 * Returns colors corresponding to the input values. The Float32Array returned contains RGB values in sequence.
 * Not storing the alpha channel mainly because it's always the same and we should be able to fill that in the shader.
 */
function mapValuesToColors(
  values: string[] | number[] | Float64Array | BigInt64Array,
  colorScale: string | string[] = "viridis"
): Float32Array {

  if (Array.isArray(values) && values.every((d) => typeof d === "string")) {
    //~ qualitative data
    return mapQualitativeValuesToColors(values, colorScale);
  }

  //~ quantitative data
  return mapQuantitativeValuesToColors(values, colorScale);
}

function mapQualitativeValuesToColors(values: string[], colorScale: string | string[]): Float32Array {
  const defaultColor = chroma("red");

  const uniqueValues = new Set<string>(values); //~ we use a Set to "collapse" the array into only unique values
  const numUniqueValues = uniqueValues.size;

  const mapColorsValues = new Map<string, ChromaColor>();

  //~ asserting that the colorScale supplied is a valid chroma scale
  if (typeof colorScale === "string") {
    assert(isBrewerPaletteName(colorScale));
  }

  let colors: string[] = [];
  if (typeof colorScale === "string") {
    colors = chroma.scale(colorScale).colors(numUniqueValues);
  } else {
    colors = colorScale; //~ In this case we assume that the user provided enough colors in the array
  }
  for (const [i, v] of [...uniqueValues].entries()) {
    const newColor = colors[i];
    if (!mapColorsValues.has(v)) {
      mapColorsValues.set(v, chroma(newColor));
    }
  }

  const correspondingColors = values.map((v) => mapColorsValues.get(v) || defaultColor);
  const colorsAsNumbers = correspondingColors.map((c) => {
    const rgb = c.gl(); // should be same as .rgb, but in 0..1 range
    // return [rgb[0], rgb[1], rgb[2]]; //~ making sure to _never_ keep the alpha channel (no matter the chroma API)
    return [rgb[0], rgb[1], rgb[2], 1.0]; //~ outputting alpha just to make it more consistent
  }).flat();
  return Float32Array.from(colorsAsNumbers);
}

function mapQuantitativeValuesToColors(
  values: number[] | Float64Array | BigInt64Array,
  colorScale: string | string[],
  min?: number,
  max?: number,
): Float32Array {
  //~ prepare the color scale
  min = min ?? 0; // default range <0, 1> seems reasonable...
  max = max ?? 1;

  //~ asserting that the colorScale supplied is a valid chroma scale
  if (typeof colorScale === "string") {
    assert(isBrewerPaletteName(colorScale));
  }

  //~ DK: For some reason, typescript complains if you don't narrow the type, even though the call is exactly the same.
  //~ This doesn't work: `const colorScale = chroma.scale(vc.color.colorScale)`
  const cScale =
    typeof colorScale === "string"
      ? chroma.scale(colorScale)
      : chroma.scale(colorScale);
  const scaledScale = cScale.domain([min, max]);
  let colorValues: chroma.Color[] = [];

  if (values instanceof Float64Array) {
    colorValues = Array.from(values, (v) => scaledScale(v));
  }

  if (values instanceof BigInt64Array) {
    colorValues = Array.from(values, (v) => scaledScale(Number(v))); //~ is it sketchy to convert bigint to number?
  }

  if (Array.isArray(values) && values.every((d) => typeof d === "number")) {
    colorValues = values.map((v) => scaledScale(v));
  }

  const colorsAsNumbers = colorValues.map((c) => {
    const rgb = c.gl(); // should be same as .rgb, but in 0..1 range
    return [rgb[0], rgb[1], rgb[2], 1.0];
  }).flat();
  return Float32Array.from(colorsAsNumbers);
}

/**
  * Displays a 3D scatterplot based on .arrow file provided as URL or an array of points.
  *
  * @param input - URL to the .arrow file or an array of points in the format [[x1, y1, z1], [x2, y2, z2], ...].
  * @param x - (optional) Name of the field in the Arrow file for the x-coordinates.
  * @param y - (optional) Name of the field in the Arrow file for the y-coordinates.
  * @param z - (optional) Name of the field in the Arrow file for the z-coordinates.
  * @param color - (optional) Name of the field in the Arrow file for the color values.
  */
function display(
  input: string | ArrayBuffer,
  encoding?: Encoding,
  options?: DisplayOptions,
): DisplayResult {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";

  let destroy = () => { };

  //~ defaults
  const {
    x = "x",
    y = "y",
    z = "z",
    color = undefined
  } = encoding || {};

  if (typeof input === 'string') {
    //~ assuming it's a URL
    const url = input;
    console.log(`display::gonna fetch from ${url}`);

    loadDataFromURL(url).then(d => {
      if (d) {
        console.log(`loaded data of size: ${d.byteLength}`);

        const [xArr, yArr, zArr, colorsArr, positionsScale] = processArrow(d, x, y, z, color);
        initWebGPUStuff(canvas, xArr, yArr, zArr, colorsArr, positionsScale, options).then(cleanup => {
          if (cleanup) destroy = cleanup;
        });
      } else {
        showCanvasError(canvas, `Failed to fetch data from: ${url}`);
      }
    }).catch((e: unknown) => {
      showCanvasError(canvas, `Failed to fetch data from: ${url}`);
      console.error(e);
    });
  } else if (input instanceof ArrayBuffer) {
    console.log(`display::using Arrow bytes (${input.byteLength})`);
    const [xArr, yArr, zArr, colorsArr, positionsScale] = processArrow(input, x, y, z, color);
    initWebGPUStuff(canvas, xArr, yArr, zArr, colorsArr, positionsScale, options).then(cleanup => {
      if (cleanup) destroy = cleanup;
    });
  } else {
    console.error("Input to `display` must be an URL string or an ArrayBuffer!");
  }

  return { canvas, destroy };
}

export { display };
