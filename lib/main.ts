import { loadDataFromURL } from "./loaders";
import { initWebGPUStuff } from "./renderer";
import { tableFromIPC } from "@uwdata/flechette";

function processArrow(b: ArrayBuffer, xField?: string, yField?: string, zField?: string, colorField?: string): [Float32Array, Float32Array, Float32Array] {
  const table = tableFromIPC(b);
  console.log("loaded table: ");
  console.log(table.schema);

  const columns = table.toColumns();
  console.log(columns);

  const xArr = xField ? columns[xField] as Float32Array : columns.x as Float32Array;
  const yArr = yField ? columns[yField] as Float32Array : columns.y as Float32Array;
  const zArr = zField ? columns[zField] as Float32Array : columns.z as Float32Array;

  //TODO: I guess I don't need to interlace: I can just put these to separate buffers

  // TODO: normalize here or in shader? still need to find the bounds
  //const newXArr = normalize(xArr as Float32Array);
  //const newYArr = normalize(yArr as Float32Array);
  //const newZArr = normalize(zArr as Float32Array);
  //console.log(`newXArr: ${newXArr}`);

  //const combinedArr = new Float32Array(3 * newXArr.length);
  //for (const [i, v] of newXArr.entries()) {
  //  const x = v;
  //  const y = newYArr[i];
  //  const z = newZArr[i];
  //  combinedArr.set([x, y, z], i * 3);
  //}
  //return combinedArr;
  return [xArr, yArr, zArr];
}

// TODO: I actually can't just normalize the arrays separately, because that'll deform the space
//function normalize(arr: Float32Array): Float32Array {
//  let min = Infinity;
//  let max = -Infinity;
//  for (const v of arr) {
//    min = (v < min) ? v : min;
//    max = (v > max) ? v : max;
//  }
//
//  const newArr = new Float32Array(arr.length);
//  for (const [i, v] of arr.entries()) {
//    const newVal = (v - min) / (max - min);
//    newArr.set([newVal], i);
//  }
//  return newArr;
//}

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
