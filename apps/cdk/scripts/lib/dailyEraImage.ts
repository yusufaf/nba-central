/**
 * Pixel logic for refresh-daily-era: finds the two jerseys in a
 * bballjerseys.com image and crops away everything that names the answer -
 * the year label over each jersey, the watermark, the era caption under the
 * shorts ("NBA 50th Anniversary") and the site handle.
 *
 * Every image shares one template: a 400x400 court, a year label over each
 * jersey at one of three heights, and the jerseys below it. The thresholds
 * below were measured on all 792 home/road images; the script reports any
 * image they reject instead of guessing.
 *
 * Works on raw 3-channel RGB so it stays pure and testable - the script does
 * the decoding.
 */

export interface RgbImage {
	data: Uint8Array;
	width: number;
	height: number;
}

export type CropTier = "classic" | "mid" | "modern";

export interface CropBox {
	tier: CropTier;
	labelTop: number;
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export type DropReason =
	| "size"
	| "frame-template"
	| "no-label"
	| "label-mismatch"
	| "unknown-tier"
	| "top-offset"
	| "bottom-window"
	| "width";

export type CropResult =
	| { ok: true; box: CropBox }
	| { ok: false; reason: DropReason; box?: Partial<CropBox> };

const SIZE = 400;

// Label text against the court. Court lines measure 30-60 from the
// background; at 100, court arcs and label/jersey merges broke detection.
const STRONG = 200;
// Jersey body and outline. At 200, green-on-green and maroon-on-maroon
// jerseys lose their outlines.
const BODY = 100;
// Strong label runs measured at most 10 rows tall.
const LABEL_H = 10;
// Two empty rows end the shorts. Three merged 24 modern images into their
// caption ("911 Commemorative Patches").
const BOTTOM_GAP = 2;

// The outer 8 columns on each side: always court, never jersey.
const edgeColumns = (width: number) => [...Array(8).keys()].flatMap((x) => [x, width - 1 - x]);
const LABEL_COLUMNS = { L: [50, 150], R: [250, 350] } as const;
const HALF_COLUMNS = { L: [8, 200], R: [200, 392] } as const;

// Measured label tops: 23 (296 images), 33 (75), 48 (399), 49 (12). Measured
// bottoms: classic 328-344, mid 350-356, modern 363-366.
const TIERS: { tier: CropTier; label: [number, number]; bottom: [number, number] }[] = [
	{ tier: "modern", label: [22, 24], bottom: [360, 368] },
	{ tier: "mid", label: [32, 34], bottom: [346, 356] },
	{ tier: "classic", label: [47, 50], bottom: [326, 346] },
];

const pixelAt = (img: RgbImage, x: number, y: number) => {
	const i = (y * img.width + x) * 3;
	return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

const l1 = (a: ArrayLike<number>, b: ArrayLike<number>) =>
	Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

const median = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length / 2;
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[Math.floor(mid)];
};

/**
 * The OKC/BOS frame template (10 images) puts a white frame at x 8-40 inside a
 * coloured border, and has no year labels to anchor a crop on.
 */
export const isFrameTemplate = (img: RgbImage) => {
	let hits = 0;
	for (let y = 100; y < 300; y++) {
		const frame = pixelAt(img, 30, y);
		if (Math.min(...frame) > 235 && l1(frame, pixelAt(img, 5, y)) > 120) hits++;
	}
	return hits / 200 > 0.9;
};

/**
 * Per pixel, the L1 RGB distance from its row's background: the per-channel
 * median of the outer 8 columns on each side. Per row, because the court
 * shades top to bottom.
 */
export const backgroundDistance = (img: RgbImage) => {
	const { width, height } = img;
	const distance = new Uint16Array(width * height);
	const columns = edgeColumns(width);
	for (let y = 0; y < height; y++) {
		const edge = columns.map((x) => pixelAt(img, x, y));
		const bg = [0, 1, 2].map((c) => median(edge.map((p) => p[c])));
		for (let x = 0; x < width; x++) distance[y * width + x] = l1(pixelAt(img, x, y), bg);
	}
	return distance;
};

const countRow = (
	distance: Uint16Array,
	width: number,
	y: number,
	[x0, x1]: readonly [number, number],
	threshold: number,
) => {
	let count = 0;
	for (let x = x0; x < x1; x++) if (distance[y * width + x] > threshold) count++;
	return count;
};

interface HalfExtent {
	labelTop: number;
	jerseyTop: number;
	jerseyBottom: number;
}

const scanHalf = (distance: Uint16Array, half: "L" | "R"): HalfExtent | null => {
	let labelTop = -1;
	for (let y = 14; y < 100; y++) {
		if (countRow(distance, SIZE, y, LABEL_COLUMNS[half], STRONG) >= 2) {
			labelTop = y;
			break;
		}
	}
	if (labelTop < 0) return null;

	let y = labelTop + LABEL_H;
	while (y < 200 && countRow(distance, SIZE, y, HALF_COLUMNS[half], BODY) < 2) y++;
	const jerseyTop = y;

	let last = jerseyTop;
	let gap = 0;
	for (; y < SIZE; y++) {
		if (countRow(distance, SIZE, y, HALF_COLUMNS[half], BODY) >= 2) {
			last = y;
			gap = 0;
		} else if (++gap >= BOTTOM_GAP) {
			break;
		}
	}
	return { labelTop, jerseyTop, jerseyBottom: last + 1 };
};

/**
 * Finds the box around both jerseys, from just under the year labels to the
 * end of the shorts, or says why the image can't be cropped safely. `bottom`
 * and `right` are exclusive.
 */
export const findCropBox = (img: RgbImage): CropResult => {
	if (img.width !== SIZE || img.height !== SIZE) return { ok: false, reason: "size" };
	if (isFrameTemplate(img)) return { ok: false, reason: "frame-template" };

	const distance = backgroundDistance(img);
	const left = scanHalf(distance, "L");
	const right = scanHalf(distance, "R");
	if (!left || !right) return { ok: false, reason: "no-label" };
	if (Math.abs(left.labelTop - right.labelTop) > 1) return { ok: false, reason: "label-mismatch" };

	const labelTop = Math.min(left.labelTop, right.labelTop);
	const tier = TIERS.find((t) => labelTop >= t.label[0] && labelTop <= t.label[1]);
	if (!tier) return { ok: false, reason: "unknown-tier", box: { labelTop } };

	const top = Math.max(Math.min(left.jerseyTop, right.jerseyTop), labelTop + LABEL_H + 1);
	const bottom = Math.max(left.jerseyBottom, right.jerseyBottom);

	let boxLeft = -1;
	let boxRight = -1;
	for (let x = 8; x < SIZE - 8; x++) {
		let count = 0;
		for (let y = top; y < bottom; y++) if (distance[y * SIZE + x] > BODY) count++;
		if (count >= 3) {
			if (boxLeft < 0) boxLeft = x;
			boxRight = x + 1;
		}
	}

	const box: CropBox = { tier: tier.tier, labelTop, top, bottom, left: boxLeft, right: boxRight };
	if (top - labelTop > 20) return { ok: false, reason: "top-offset", box };
	if (bottom < tier.bottom[0] || bottom > tier.bottom[1]) return { ok: false, reason: "bottom-window", box };
	const width = boxRight - boxLeft;
	if (width < 300 || width > 370) return { ok: false, reason: "width", box };
	return { ok: true, box };
};

export const extractCrop = (img: RgbImage, box: CropBox): RgbImage => {
	const width = box.right - box.left;
	const height = box.bottom - box.top;
	const data = new Uint8Array(width * height * 3);
	for (let y = 0; y < height; y++) {
		const start = ((box.top + y) * img.width + box.left) * 3;
		data.set(img.data.subarray(start, start + width * 3), y * width * 3);
	}
	return { data, width, height };
};

/**
 * Percent of pixels that differ (L1 > 60) between two crops, at the best of
 * the nine 1 px alignments. Crops are aligned by their top-left corner: their
 * origins are the detected jersey edges, so a size difference comes from the
 * bottom/right extents.
 *
 * Returns Infinity when the sizes differ by more than 4 px or every alignment
 * passes `limitPercent` - an alignment stops counting as soon as it does,
 * which keeps comparing unrelated jerseys cheap.
 */
export const cropDiffPercent = (a: RgbImage, b: RgbImage, limitPercent: number) => {
	if (Math.abs(a.width - b.width) > 4 || Math.abs(a.height - b.height) > 4) return Infinity;

	let best = Infinity;
	for (let dy = -1; dy <= 1; dy++) {
		for (let dx = -1; dx <= 1; dx++) {
			const ax = Math.max(dx, 0);
			const ay = Math.max(dy, 0);
			const bx = Math.max(-dx, 0);
			const by = Math.max(-dy, 0);
			const width = Math.min(a.width - ax, b.width - bx);
			const height = Math.min(a.height - ay, b.height - by);
			const total = width * height;
			const limit = (limitPercent / 100) * total;

			let differing = 0;
			for (let y = 0; y < height && differing <= limit; y++) {
				let ia = ((ay + y) * a.width + ax) * 3;
				let ib = ((by + y) * b.width + bx) * 3;
				for (let x = 0; x < width; x++, ia += 3, ib += 3) {
					if (
						Math.abs(a.data[ia] - b.data[ib]) +
							Math.abs(a.data[ia + 1] - b.data[ib + 1]) +
							Math.abs(a.data[ia + 2] - b.data[ib + 2]) >
						60
					) {
						differing++;
					}
				}
			}
			if (differing <= limit) best = Math.min(best, (differing / total) * 100);
		}
	}
	return best;
};

/** The court colour behind the jerseys, for filling the puzzle's margins. */
export const medianEdgeColour = (img: RgbImage): [number, number, number] => {
	const channels: number[][] = [[], [], []];
	const columns = edgeColumns(img.width);
	for (let y = 0; y < img.height; y++) {
		for (const x of columns) {
			const p = pixelAt(img, x, y);
			for (let c = 0; c < 3; c++) channels[c].push(p[c]);
		}
	}
	return [0, 1, 2].map((c) => Math.round(median(channels[c]))) as [number, number, number];
};
