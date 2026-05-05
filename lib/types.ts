type BaseEncoding = {
	x?: string;
	y?: string;
	z?: string;
	color?: string;
};

type PointEncoding = BaseEncoding & {
	mark?: "point";
};

export type SpriteEncoding = BaseEncoding & {
	mark: "sprite";
	spritesheetUrl: string;
	width: number;
	height: number;
};

export type Encoding = PointEncoding | SpriteEncoding;

export type DisplayOptions = {
	backgroundColor?: string;
	onSelect?: (indices: number[]) => void;
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
