import * as sctrd from "./main.ts";

const SPRITE_MAP_URL = "/data/spritesheet.png";
const THUMBNAIL_SIZE = 32;
const ARROW_URL = "/data/drawings-embedding.arrow";

const { canvas } = sctrd.display(ARROW_URL, {}, {
  spriteMapUrl: SPRITE_MAP_URL,
  thumbnailWidth: THUMBNAIL_SIZE,
  thumbnailHeight: THUMBNAIL_SIZE,
});

const appEl = document.querySelector("#app");
if (appEl) {
  appEl.appendChild(canvas);
}
