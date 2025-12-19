import { loadDataFromURL } from "./loaders.ts";
import { initWebGPUStuff } from "./renderer.ts";
import { tableFromIPC } from "@uwdata/flechette";
import { DisplayOptions } from "./types.ts";
import { assert } from "./assert.ts";
import chroma from "chroma-js";
import type { Color as ChromaColor } from "chroma-js";

function processArrow(b: ArrayBuffer, xField?: string, yField?: string, zField?: string, colorField?: string): [Float32Array, Float32Array, Float32Array, Float32Array];
function processArrow(b: ArrayBuffer, xField?: string, yField?: string, zField?: string, colorField?: string): [Float32Array, Float32Array, Float32Array];
function processArrow(b: ArrayBuffer, xField?: string, yField?: string, zField?: string, colorField?: string) {
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

  // TODO: normalize here or in shader? still need to find the bounds
  //const newXArr = normalize(xArr as Float32Array);
  //const newYArr = normalize(yArr as Float32Array);
  //const newZArr = normalize(zArr as Float32Array);
  //console.log(`newXArr: ${newXArr}`);

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
    return [xArr, yArr, zArr, colorsBuffer];
  }

  return [xArr, yArr, zArr];
}

/*
 * Asserting function for checking if a string is a valid chroma.js Brewer palette name
 */
export function isBrewerPaletteName(
  colorString: string,
): colorString is chroma.BrewerPaletteName {
  const brewerPalettes = Object.keys(chroma.brewer).map((name) =>
    name.toLowerCase(),
  );
  return brewerPalettes.includes(colorString.toLowerCase());
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
  return mapQuantitativeValuesToColors();
}

function mapQualitativeValuesToColors(values: string[], colorScale: string | string[]): Float32Array {
  const defaultColor = chroma("red");

  const uniqueValues = new Set<string>(values); //~ we use a Set to "collapse" the array into only unique values
  const numUniqueValues = uniqueValues.size;

  const mapColorsValues = new Map<string, ChromaColor>();


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
    return [rgb[0], rgb[1], rgb[2]]; //~ making sure to _never_ keep the alpha channel (no matter the chroma API)
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
    return [rgb[0], rgb[1], rgb[2]]; //~ making sure to _never_ keep the alpha channel (no matter the chroma API)
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
  input: string | Array<Array<number>> | ArrayBuffer,
  options?: DisplayOptions,
  //~ TODO: just put these into an 'encoding' object, so that it doesn't matter which one of these you want and need to define
  color?: string,
  x: string = "x",
  y: string = "y",
  z: string = "z"
): HTMLCanvasElement {
  const cEl = document.createElement("canvas");
  cEl.style.width = "100%";

  if (typeof input === 'string') {
    //~ assuming it's a URL
    const url = input;
    console.log(`display::gonna fetch from ${url}`);

    loadDataFromURL(url).then(d => {
      if (d) {
        console.log(`loaded data of size: ${d.byteLength}`);

        const points = processArrow(d);

        initWebGPUStuff(cEl, ...points, options);
      } else {
        console.log("failed fetching the data");
      }
    }).catch(_ => { console.log("failed fetching the data") });
  } else if (input instanceof ArrayBuffer) {
    console.log(`display::using Arrow bytes (${input.byteLength})`);
    const points = processArrow(input, x, y, z, color);
    initWebGPUStuff(cEl, ...points, options);
  } else {
    console.warn("not implemented!");
  }

  return cEl;
}

export { display };
