import * as sctrd from "./main.ts";
import { tableFromArrays, tableToIPC } from "@uwdata/flechette";
import { assert } from "./assert.ts";

// const c = prepareLinearExample();
const c = prepareRandomExample();

let appEl = document.querySelector('#app');
if (c && appEl) {
  appEl.appendChild(c);
}

function prepareLinearExample(): HTMLCanvasElement {
  const linCoords = generateLinearSequence(100);
  const linCoordsTable = tableFromArrays(linCoords);
  console.log(linCoords);

  assert(linCoordsTable, "gotta be able to make a table from linCoords");
  const tableIPC = tableToIPC(linCoordsTable, {});
  assert(tableIPC, "gotta be able to make an IPC from the table");

  const c = sctrd.display(tableIPC.buffer, { backgroundColor: "#000000" });
  return c;
}

function prepareRandomExample(): HTMLCanvasElement {
  const coords = generateRandomPoints(100, 10);
  // const coords = generateRandomPoints(100000, 30);
  const coordsTable = tableFromArrays(coords);
  console.log(coords);

  assert(coordsTable, "gotta be able to make a table from linCoords");
  const tableIPC = tableToIPC(coordsTable, {});
  assert(tableIPC, "gotta be able to make an IPC from the table");

  // const c = sctrd.display(tableIPC.buffer, { backgroundColor: "#e6e6fa" });
  // const c = sctrd.display(tableIPC.buffer);
  const c = sctrd.display(tableIPC.buffer, {}, "category");
  return c;
}

function preparePenguinsExample(): HTMLCanvasElement {
  const penguinsURL = "https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow";
  const c = sctrd.display(penguinsURL);
  return c;
}

type CoordArrays = {
  x: Array<number>,
  y: Array<number>,
  z: Array<number>,
  category?: Array<string>,
};

/**
  * Generates a linear sequence of 3D coordinates, from [0, 0, 0] to [1, 1, 1].
  */
function generateLinearSequence(numPoints: number): CoordArrays {
  const points = {
    x: new Array<number>(),
    y: new Array<number>(),
    z: new Array<number>(),
  };

  const step = 1.0 / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    points.x.push(i * step);
    points.y.push(i * step);
    points.z.push(i * step);
  }
  return points;
}

function generateRandomPoints(numPoints: number, scale: number = 1.0): CoordArrays {
  const points = {
    x: new Array<number>(),
    y: new Array<number>(),
    z: new Array<number>(),
    category: new Array<string>(),
  };

  const categories = ["A", "B", "C"];

  for (let i = 0; i < numPoints; i++) {
    points.x.push(Math.random() * scale - scale / 2);
    points.y.push(Math.random() * scale - scale / 2);
    points.z.push(Math.random() * scale - scale / 2);
    points.category.push(categories[i % categories.length]);
  }
  return points;
}
