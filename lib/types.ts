type BaseEncoding = {
	x?: string;
	y?: string;
	z?: string;
	color?: string;
};

type PointEncoding = BaseEncoding & {
	mark?: "point";
};

export type BillboardEncoding = BaseEncoding & {
	mark: "billboard";
	spriteMapUrl: string;
	thumbnailWidth: number;
	thumbnailHeight: number;
};

export type Encoding = PointEncoding | BillboardEncoding;

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
