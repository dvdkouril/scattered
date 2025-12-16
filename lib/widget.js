import * as sctrd from "./main.ts";

/** @param {{ model: DOMWidgetModel, el: HTMLElement }} context */
function render({ model, el }) {
	// Render model contents and setup dynamic updates
	console.log("Hellooooooooo~~~~~~~~~~~~~~~~~~");
	const table = model.get("input_table"); //~ Bytes (py) -> DataView (js)
	console.log(typeof (table));

	const c =
		table ?
			sctrd.display(table.buffer) :
			sctrd.display("https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow");

	if (c) {
		el.appendChild(c);
	}
}
export default { render }; // export for anywidget
