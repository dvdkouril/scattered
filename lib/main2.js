function display(url) {
	console.log("fake display function");

	const cEl = document.createElement("canvas");
	cEl.width = 400;
	cEl.height = 300;

	const ctx = cEl.getContext("2d");

	// draw background
	ctx.fillStyle = "crimson";
	ctx.fillRect(0, 0, cEl.width, cEl.height);

	return cEl;
}

export { display };
