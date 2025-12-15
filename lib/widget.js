import * as sctrd from "./main.ts";

/** @param {{ model: DOMWidgetModel, el: HTMLElement }} context */
function render({ model, el }) {
	// Render model contents and setup dynamic updates
	console.log("Hellooooooooo~~~~~~~~~~~~~~~~~~");

	const c = sctrd.display("https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow");
	if (c) {
		el.appendChild(c);
	}
	// const header = document.createElement("h1");
	// header.textContent = "hello from scattered.";
	// el.appendChild(header);
}
export default { render }; // export for anywidget
