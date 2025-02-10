import { loadDataFromURL } from "./loaders";
import { initWebGPUStuff } from "./renderer";

function display(url: string): HTMLCanvasElement {
  const cEl = document.createElement("canvas");
  cEl.style.width = "100%";

  console.log(`gonna fetch from ${url}`);
  loadDataFromURL(url).then(d => {
    if (d) {
      console.log(`loaded data of size: ${d.byteLength}`);
    } else {
      console.log("failed fetching the data");
    }
    d?.byteLength
  }).catch(_ => { console.log("failed fetching the data") });

  initWebGPUStuff(cEl);

  return cEl;
}

export { display };
