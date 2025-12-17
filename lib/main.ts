import { loadDataFromURL } from "./loaders";
import { initWebGPUStuff } from "./renderer";
import { tableFromIPC } from "@uwdata/flechette";

function processArrow(b: ArrayBuffer, xField?: string, yField?: string, zField?: string, colorField?: string): [Float32Array, Float32Array, Float32Array] {
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

  return [xArr, yArr, zArr];
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
function display(input: string | Array<Array<number>> | ArrayBuffer, x: string = "x", y: string = "y", z: string = "z", color?: string): HTMLCanvasElement {
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

        initWebGPUStuff(cEl, ...points);
      } else {
        console.log("failed fetching the data");
      }
    }).catch(_ => { console.log("failed fetching the data") });
  } else if (input instanceof ArrayBuffer) {
    console.log(`display::using Arrow bytes (${input.byteLength})`);
    const points = processArrow(input, x, y, z, color);
    initWebGPUStuff(cEl, ...points);
  } else {
    console.warn("not implemented!");
  }

  return cEl;
}

export { display };
