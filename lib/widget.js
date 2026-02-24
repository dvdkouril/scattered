import * as sctrd from "./main.ts";

/** @param {{ model: DOMWidgetModel, el: HTMLElement }} context */
function render({ model, el }) {
	const table = model.get("input_table"); //~ Bytes (py) -> DataView (js)
	const encoding = model.get("encoding");

	const options = {
		onSelect: (indices) => {
			model.set("selected_indices", indices);
			model.save_changes();
		},
	};

	const { canvas, destroy } =
		table ?
			sctrd.display(table.buffer, encoding, options) :
			sctrd.display("https://raw.githubusercontent.com/dvdkouril/sample-3d-scatterplot-data/main/penguins.arrow", encoding, options);

	el.appendChild(canvas);

	return destroy; // anywidget calls this when the widget is removed
}
export default { render }; // export for anywidget
