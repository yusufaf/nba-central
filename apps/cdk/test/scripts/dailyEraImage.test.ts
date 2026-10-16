import { describe, it, expect } from "vitest";
import {
	backgroundDistance,
	cropDiffPercent,
	extractCrop,
	findCropBox,
	isFrameTemplate,
	medianEdgeColour,
	type RgbImage,
} from "../../scripts/lib/dailyEraImage";

type Rgb = [number, number, number];

const BG: Rgb = [200, 40, 40];
const WHITE: Rgb = [255, 255, 255];
const clamp = (v: number) => Math.max(0, Math.min(255, v));
const shade = (c: Rgb, d: Rgb): Rgb => [clamp(c[0] + d[0]), clamp(c[1] + d[1]), clamp(c[2] + d[2])];

const blank = (width: number, height: number, colour: Rgb): RgbImage => {
	const data = new Uint8Array(width * height * 3);
	for (let i = 0; i < width * height; i++) data.set(colour, i * 3);
	return { data, width, height };
};

const fill = (img: RgbImage, x0: number, x1: number, y0: number, y1: number, colour: Rgb) => {
	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) img.data.set(colour, (y * img.width + x) * 3);
	}
};

const pixel = (img: RgbImage, x: number, y: number) =>
	Array.from(img.data.subarray((y * img.width + x) * 3, (y * img.width + x) * 3 + 3));

interface JerseyImageOptions {
	labelTop?: number;
	labelTopRight?: number;
	jerseyTop?: number;
	bottom?: number;
	fill?: Rgb;
	outline?: Rgb;
	captionY?: number;
	frame?: boolean;
	size?: number;
}

// Paints the bballjerseys.com layout: court lines, watermark, a year label
// over each of the two jerseys, an optional era caption and the handle.
const makeJerseyImage = (opts: JerseyImageOptions = {}): RgbImage => {
	const size = opts.size ?? 400;
	const labelTop = opts.labelTop ?? 48;
	const labelTopRight = opts.labelTopRight ?? labelTop;
	const jerseyTop = opts.jerseyTop ?? labelTop + 13;
	const bottom = opts.bottom ?? 341;
	const img = blank(size, size, BG);
	const court = shade(BG, [25, 25, 25]);

	fill(img, 195, 206, 0, size, court);
	fill(img, 40, 361, 14, 19, court);
	fill(img, 150, 250, 2, 12, WHITE);
	fill(img, 75, 125, labelTop, labelTop + 10, WHITE);
	fill(img, 275, 325, labelTopRight, labelTopRight + 10, WHITE);

	const outline = opts.outline ?? shade(BG, [-120, -30, -30]);
	for (const [x0, x1] of [[40, 190], [210, 360]]) {
		fill(img, x0, x1, jerseyTop, bottom, outline);
		fill(img, x0 + 2, x1 - 2, jerseyTop + 2, bottom - 2, opts.fill ?? WHITE);
	}

	if (opts.captionY !== undefined) fill(img, 150, 250, opts.captionY, opts.captionY + 9, WHITE);
	fill(img, 150, 250, 385, 394, WHITE);

	if (opts.frame) {
		fill(img, 8, 40, 0, size, WHITE);
		fill(img, 0, 8, 0, size, [20, 40, 160]);
	}
	return img;
};

// Deterministic high-contrast noise: any 1 px misalignment differs almost
// everywhere, so only the true alignment can score low.
const noise = (width: number, height: number, seed: number): RgbImage => {
	const img = blank(width, height, [0, 0, 0]);
	let s = seed;
	for (let i = 0; i < img.data.length; i++) {
		s = (s * 1103515245 + 12345) >>> 0;
		img.data[i] = (s >>> 16) & 0xff;
	}
	return img;
};

const crop = (img: RgbImage, x0: number, y0: number, width: number, height: number) =>
	extractCrop(img, { tier: "classic", labelTop: 0, top: y0, bottom: y0 + height, left: x0, right: x0 + width });

describe("isFrameTemplate", () => {
	it("detects the OKC/BOS frame template", () => {
		expect(isFrameTemplate(makeJerseyImage({ frame: true }))).toBe(true);
	});

	it("passes the standard template", () => {
		expect(isFrameTemplate(makeJerseyImage())).toBe(false);
	});
});

describe("backgroundDistance", () => {
	it("is 0 on the background and the court lines' contrast on a court stripe", () => {
		const img = makeJerseyImage();
		const d = backgroundDistance(img);
		expect(d[30 * 400 + 100]).toBe(0);
		expect(d[30 * 400 + 200]).toBe(75);
	});
});

describe("findCropBox", () => {
	it("(a) crops a classic image to the jerseys", () => {
		expect(findCropBox(makeJerseyImage({ labelTop: 48, jerseyTop: 61, bottom: 341 }))).toEqual({
			ok: true,
			box: { tier: "classic", labelTop: 48, top: 61, bottom: 341, left: 40, right: 360 },
		});
	});

	it("(b) never starts the crop inside the label", () => {
		const result = findCropBox(makeJerseyImage({ labelTop: 48, jerseyTop: 58, bottom: 341 }));
		expect(result.ok && result.box.top).toBe(59);
	});

	it("(c) stops at a 2-row gap above an era caption", () => {
		const result = findCropBox(makeJerseyImage({ labelTop: 23, bottom: 365, captionY: 367 }));
		expect(result).toMatchObject({ ok: true, box: { tier: "modern", bottom: 365 } });
	});

	it("(d) drops an image whose caption sits 1 row under the shorts", () => {
		const result = findCropBox(makeJerseyImage({ labelTop: 23, bottom: 365, captionY: 366 }));
		expect(result).toMatchObject({ ok: false, reason: "bottom-window" });
	});

	it("(e) drops labels that disagree between the halves", () => {
		const result = findCropBox(makeJerseyImage({ labelTop: 23, labelTopRight: 48, bottom: 365 }));
		expect(result).toMatchObject({ ok: false, reason: "label-mismatch" });
	});

	it("(f) drops a label outside every known tier", () => {
		expect(findCropBox(makeJerseyImage({ labelTop: 40 }))).toMatchObject({
			ok: false,
			reason: "unknown-tier",
		});
	});

	it("(g) does not take a court line for a label", () => {
		const result = findCropBox(makeJerseyImage({ labelTop: 48 }));
		expect(result.ok && result.box.labelTop).toBe(48);
	});

	it("(h) finds a low-contrast jersey by its outline", () => {
		const result = findCropBox(
			makeJerseyImage({ fill: BG, outline: shade(BG, [-60, -60, -60]) }),
		);
		expect(result).toMatchObject({ ok: true, box: { top: 61, bottom: 341, left: 40, right: 360 } });
	});

	it("(i) drops an image that is not 400x400", () => {
		expect(findCropBox(blank(300, 300, BG))).toMatchObject({ ok: false, reason: "size" });
	});

	it("(j) drops the frame template", () => {
		expect(findCropBox(makeJerseyImage({ frame: true }))).toMatchObject({
			ok: false,
			reason: "frame-template",
		});
	});
});

describe("extractCrop", () => {
	it("copies the box out of the source", () => {
		const img = noise(400, 400, 1);
		const out = extractCrop(img, { tier: "classic", labelTop: 48, top: 61, bottom: 341, left: 40, right: 360 });
		expect([out.width, out.height]).toEqual([320, 280]);
		expect(pixel(out, 0, 0)).toEqual(pixel(img, 40, 61));
		expect(pixel(out, 319, 279)).toEqual(pixel(img, 359, 340));
	});
});

describe("cropDiffPercent", () => {
	const base = noise(400, 400, 7);
	const a = crop(base, 10, 10, 300, 280);

	it("is 0 for identical crops", () => {
		expect(cropDiffPercent(a, crop(base, 10, 10, 300, 280), 1.5)).toBe(0);
	});

	it("is 0 for a copy shifted by 1 px", () => {
		expect(cropDiffPercent(a, crop(base, 11, 11, 300, 280), 1.5)).toBe(0);
	});

	it("aligns crops by their top-left corner", () => {
		expect(cropDiffPercent(a, crop(base, 10, 10, 302, 283), 1.5)).toBe(0);
	});

	it("measures the share of changed pixels", () => {
		const b = crop(base, 10, 10, 300, 280);
		for (let y = 100; y < 120; y++) {
			for (let x = 100; x < 120; x++) {
				const i = (y * b.width + x) * 3;
				b.data[i] = (b.data[i] + 128) % 256;
			}
		}
		expect(cropDiffPercent(a, b, 100)).toBeCloseTo((400 / (300 * 280)) * 100, 2);
	});

	it("never matches crops whose sizes differ by more than 4 px", () => {
		expect(cropDiffPercent(a, crop(base, 10, 10, 305, 280), 100)).toBe(Infinity);
	});

	it("gives up on a different image once every alignment passes the limit", () => {
		expect(cropDiffPercent(a, crop(noise(400, 400, 8), 10, 10, 300, 280), 1.5)).toBe(Infinity);
	});
});

describe("medianEdgeColour", () => {
	it("returns the background behind the jerseys", () => {
		expect(medianEdgeColour(makeJerseyImage())).toEqual(BG);
	});
});
