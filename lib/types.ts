export type Encoding = {
	x?: string;
	y?: string;
	z?: string;
	color?: string;
};

export type DisplayOptions = {
	backgroundColor?: string;
};

export type DisplayResult = {
	canvas: HTMLCanvasElement;
	destroy: () => void;
};
