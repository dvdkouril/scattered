import * as sctrd from "./main.ts";

const c = sctrd.display("https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow");

let appEl = document.querySelector('#app');
if (c && appEl) {
  appEl.appendChild(c);
}
