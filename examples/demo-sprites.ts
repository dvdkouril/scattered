import * as sctrd from "../lib/main.ts";
import { tableFromArrays, tableToIPC } from "@uwdata/flechette";
import { assert } from "../lib/assert.ts";

// MNIST 10k sprite sheet from TensorFlow Embedding Projector (100x100 grid of 28x28 tiles)
const SPRITE_MAP_URL =
  "https://raw.githubusercontent.com/tensorflow/embedding-projector-standalone/master/oss_data/mnist_10k_sprite.png";
const THUMBNAIL_SIZE = 28; // each MNIST digit is 28x28 pixels
const NUM_POINTS = 500;

const coords = generateRandomPoints(NUM_POINTS, 10);
const coordsTable = tableFromArrays(coords);

assert(coordsTable, "should be able to make a table");
const tableIPC = tableToIPC(coordsTable, {});
assert(tableIPC, "should be able to make IPC");

const { canvas } = sctrd.display(tableIPC.buffer, {
  mark: "billboard",
  spriteMapUrl: SPRITE_MAP_URL,
  thumbnailWidth: THUMBNAIL_SIZE,
  thumbnailHeight: THUMBNAIL_SIZE,
}, { backgroundColor: "#cccccc" });

const appEl = document.querySelector("#app");
if (appEl) {
  appEl.appendChild(canvas);
}

function generateRandomPoints(numPoints: number, scale: number) {
  const x = new Array<number>();
  const y = new Array<number>();
  const z = new Array<number>();

  for (let i = 0; i < numPoints; i++) {
    x.push(Math.random() * scale - scale / 2);
    y.push(Math.random() * scale - scale / 2);
    z.push(Math.random() * scale - scale / 2);
  }
  return { x, y, z };
}
