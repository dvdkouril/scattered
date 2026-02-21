export type Encoding = {
	x?: string;
	y?: string;
	z?: string;
	color?: string;
};

export type DisplayOptions = {
	backgroundColor?: string;
};

export type ScreenshotOptions = {
	filename?: string;
	width?: number;
	height?: number;
};

export type DisplayResult = {
	canvas: HTMLCanvasElement;
	destroy: () => void;
	screenshot: (options?: ScreenshotOptions) => Promise<void>;
};
