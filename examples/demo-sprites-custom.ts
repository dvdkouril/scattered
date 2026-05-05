import * as sctrd from "../lib/main.ts";

const SPRITE_MAP_URL = "/data/spritesheet.png";
const THUMBNAIL_SIZE = 32;
const ARROW_URL = "/data/drawings-embedding-clip.arrow";

const { canvas } = sctrd.display(ARROW_URL, {
  mark: "sprite",
  spritesheetUrl: SPRITE_MAP_URL,
  spriteWidth: THUMBNAIL_SIZE,
  spriteHeight: THUMBNAIL_SIZE,
});

const appEl = document.querySelector("#app");
if (appEl) {
  appEl.appendChild(canvas);
}
