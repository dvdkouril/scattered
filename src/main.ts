import { loadDataFromURL } from "./loaders";
import { initWebGPUStuff } from "./renderer";
import { tableFromIPC } from "@uwdata/flechette";

function processArrow(b: ArrayBuffer): [Float32Array, Float32Array, Float32Array] {
  const table = tableFromIPC(b);
  console.log("loaded table: ");
  console.log(table.schema);

  const columns = table.toColumns();
  console.log(columns);

  //TODO: assert "x" in columns && "y" in columns && "z" in columns
  const xArr = columns.x as Float32Array;
  const yArr = columns.y as Float32Array;
  const zArr = columns.z as Float32Array;
  //console.log(xArr);
  //console.log(yArr);
  //console.log(zArr);

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

function display(url: string): HTMLCanvasElement {
  const cEl = document.createElement("canvas");
  cEl.style.width = "100%";

  console.log(`gonna fetch from ${url}`);

  loadDataFromURL(url).then(d => {
    if (d) {
      console.log(`loaded data of size: ${d.byteLength}`);

      const points = processArrow(d);

      initWebGPUStuff(cEl, ...points);
    } else {
      console.log("failed fetching the data");
    }
    d?.byteLength
  }).catch(_ => { console.log("failed fetching the data") });

  return cEl;
}

export { display };
