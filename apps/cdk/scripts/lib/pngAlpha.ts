/**
 * Turns the white background of a palette PNG into real transparency.
 *
 * Basketball-Reference serves every team logo as a 125x125 palette PNG with an
 * opaque white background and no tRNS chunk, so on nba-central's dark theme
 * each logo renders as a hard white square. Keying out white globally is wrong
 * - plenty of logos use white inside the artwork (lettering, jersey trim, the
 * Celtics leprechaun's shirt) - so this flood-fills inward from the image
 * border instead and only clears white that is actually connected to the edge.
 *
 * The rewrite stays in palette space: pixel indices are remapped to one extra
 * palette entry that a tRNS chunk marks fully transparent, so the artwork's own
 * colours are never touched. Output is always re-emitted at bit depth 8 because
 * the added entry can push a 4-bit palette past 16 colours.
 *
 * Node's builtin zlib does the inflate/deflate; no image library is involved.
 */
import * as zlib from "zlib";

/**
 * How far from white a palette entry may sit, measured as 255 minus its darkest
 * channel, to take part in the background fill.
 *
 * Two thresholds rather than one, because these images are not clean: BBRef's
 * PNGs are re-encodes of lossy sources, so about 9% have corners like
 * (252, 254, 252), and a few - the 1968 SuperSonics among them - dither their
 * background out of entries as far off as (220, 235, 228). A single strict
 * threshold leaves that dither behind as speckle; a single loose one starts
 * eating pale artwork.
 *
 * So the fill may only START from a border pixel that is convincingly white
 * (SEED), and from there may SPREAD through anything merely pale. Pale colours
 * that are part of the logo - the 1947 Warriors' cream (253, 244, 196), say -
 * are enclosed by darker artwork, so the fill never reaches them.
 */
const SEED_DISTANCE = 12;
const SPREAD_DISTANCE = 40;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Chunks this module rebuilds itself; anything else is carried through. */
const REBUILT_CHUNKS = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);

type Chunk = { type: string; data: Uint8Array };

type Header = {
	width: number;
	height: number;
	depth: number;
	colorType: number;
	interlace: number;
};

const CRC_TABLE = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c;
	}
	return table;
})();

const crc32 = (bytes: Uint8Array) => {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
};

const readU32 = (bytes: Uint8Array, offset: number) =>
	((bytes[offset] << 24) |
		(bytes[offset + 1] << 16) |
		(bytes[offset + 2] << 8) |
		bytes[offset + 3]) >>>
	0;

const writeU32 = (bytes: Uint8Array, offset: number, value: number) => {
	bytes[offset] = (value >>> 24) & 0xff;
	bytes[offset + 1] = (value >>> 16) & 0xff;
	bytes[offset + 2] = (value >>> 8) & 0xff;
	bytes[offset + 3] = value & 0xff;
};

export const isPngSignature = (bytes: Uint8Array) =>
	PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);

const readChunks = (png: Uint8Array): Chunk[] => {
	const chunks: Chunk[] = [];
	let offset = 8;
	while (offset + 8 <= png.length) {
		const length = readU32(png, offset);
		const type = String.fromCharCode(
			png[offset + 4],
			png[offset + 5],
			png[offset + 6],
			png[offset + 7],
		);
		const start = offset + 8;
		chunks.push({ type, data: png.subarray(start, start + length) });
		offset = start + length + 4;
		if (type === "IEND") break;
	}
	return chunks;
};

const readHeader = (data: Uint8Array): Header => ({
	width: readU32(data, 0),
	height: readU32(data, 4),
	depth: data[8],
	colorType: data[9],
	interlace: data[12],
});

const paeth = (a: number, b: number, c: number) => {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	return pb <= pc ? b : c;
};

/**
 * Reverses the per-scanline filters. Palette images are one byte per sample
 * regardless of bit depth, so the filter's "bytes per pixel" distance is always
 * 1 here.
 */
const unfilter = (raw: Uint8Array, rowBytes: number, height: number) => {
	const out = new Uint8Array(rowBytes * height);
	let pos = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[pos++];
		const rowStart = y * rowBytes;
		const priorStart = rowStart - rowBytes;
		for (let x = 0; x < rowBytes; x++) {
			const value = raw[pos + x];
			const left = x >= 1 ? out[rowStart + x - 1] : 0;
			const up = y > 0 ? out[priorStart + x] : 0;
			const upLeft = y > 0 && x >= 1 ? out[priorStart + x - 1] : 0;
			let restored: number;
			switch (filter) {
				case 0:
					restored = value;
					break;
				case 1:
					restored = value + left;
					break;
				case 2:
					restored = value + up;
					break;
				case 3:
					restored = value + ((left + up) >> 1);
					break;
				case 4:
					restored = value + paeth(left, up, upLeft);
					break;
				default:
					throw new Error(`Unknown PNG filter type ${filter} on row ${y}`);
			}
			out[rowStart + x] = restored & 0xff;
		}
		pos += rowBytes;
	}
	return out;
};

/** Expands packed 1/2/4-bit palette indices into one index per pixel. */
const unpackIndices = (
	rows: Uint8Array,
	rowBytes: number,
	{ width, height, depth }: Header,
) => {
	if (depth === 8) return rows;

	const indices = new Uint8Array(width * height);
	const perByte = 8 / depth;
	const mask = (1 << depth) - 1;
	for (let y = 0; y < height; y++) {
		const rowStart = y * rowBytes;
		for (let x = 0; x < width; x++) {
			const byte = rows[rowStart + Math.floor(x / perByte)];
			const shift = 8 - depth * ((x % perByte) + 1);
			indices[y * width + x] = (byte >> shift) & mask;
		}
	}
	return indices;
};

/**
 * Marks every pixel reachable from the border through pale palette entries,
 * starting only from border pixels that are convincingly white. Four-connected:
 * a diagonal-only gap in the artwork should not let the fill leak into an
 * enclosed white region.
 */
const floodFillBackground = (
	indices: Uint8Array,
	width: number,
	height: number,
	isSeed: boolean[],
	isSpread: boolean[],
) => {
	const background = new Uint8Array(width * height);
	const stack: number[] = [];

	const seed = (pixel: number) => {
		if (background[pixel] || !isSeed[indices[pixel]]) return;
		background[pixel] = 1;
		stack.push(pixel);
	};

	const push = (pixel: number) => {
		if (background[pixel] || !isSpread[indices[pixel]]) return;
		background[pixel] = 1;
		stack.push(pixel);
	};

	for (let x = 0; x < width; x++) {
		seed(x);
		seed((height - 1) * width + x);
	}
	for (let y = 0; y < height; y++) {
		seed(y * width);
		seed(y * width + width - 1);
	}

	while (stack.length > 0) {
		const pixel = stack.pop() as number;
		const x = pixel % width;
		const y = (pixel - x) / width;
		if (x > 0) push(pixel - 1);
		if (x < width - 1) push(pixel + 1);
		if (y > 0) push(pixel - width);
		if (y < height - 1) push(pixel + width);
	}

	return background;
};

const buildChunk = (type: string, data: Uint8Array) => {
	const chunk = new Uint8Array(data.length + 12);
	writeU32(chunk, 0, data.length);
	for (let i = 0; i < 4; i++) {
		chunk[4 + i] = type.charCodeAt(i);
	}
	chunk.set(data, 8);
	writeU32(chunk, data.length + 8, crc32(chunk.subarray(4, data.length + 8)));
	return chunk;
};

const concat = (parts: Uint8Array[]) => {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
};

/**
 * Why an image was returned unchanged. A closed union rather than free text so
 * callers that special-case a reason - refresh-historical-logos only warns for
 * the ones that are actually surprising - fail to compile if one is renamed.
 */
export type KeyOutSkipReason =
	| "not a PNG"
	| "no IHDR/PLTE"
	| "already has transparency"
	| "not a palette PNG"
	| "interlaced"
	| "palette is full"
	| "no white in palette"
	| "no edge-connected white";

export type KeyOutResult = {
	png: Uint8Array;
	/** Pixels turned transparent; 0 means the image was left untouched. */
	clearedPixels: number;
	/** Set when the image was returned unchanged, explaining why. */
	skipped?: KeyOutSkipReason;
};

/**
 * Returns `png` with its edge-connected white background made transparent.
 *
 * Idempotent: an image that already carries a tRNS chunk is returned byte-for-
 * byte, so re-running the refresh script over already-processed files is a
 * no-op. Anything this routine can't handle safely (non-palette, interlaced, a
 * palette with no room for the transparent entry) is likewise returned
 * unchanged with `skipped` set, rather than throwing - one odd logo should not
 * fail a 234-image run.
 */
export const keyOutWhiteBackground = (png: Uint8Array): KeyOutResult => {
	if (!isPngSignature(png)) {
		return { png, clearedPixels: 0, skipped: "not a PNG" };
	}

	const chunks = readChunks(png);
	const headerChunk = chunks.find((chunk) => chunk.type === "IHDR");
	const paletteChunk = chunks.find((chunk) => chunk.type === "PLTE");
	if (!headerChunk || !paletteChunk) {
		return { png, clearedPixels: 0, skipped: "no IHDR/PLTE" };
	}
	if (chunks.some((chunk) => chunk.type === "tRNS")) {
		return { png, clearedPixels: 0, skipped: "already has transparency" };
	}

	const header = readHeader(headerChunk.data);
	if (header.colorType !== 3) {
		return { png, clearedPixels: 0, skipped: "not a palette PNG" };
	}
	if (header.interlace !== 0) {
		return { png, clearedPixels: 0, skipped: "interlaced" };
	}

	const paletteSize = Math.floor(paletteChunk.data.length / 3);
	if (paletteSize >= 256) {
		return { png, clearedPixels: 0, skipped: "palette is full" };
	}

	const isSeed: boolean[] = [];
	const isSpread: boolean[] = [];
	for (let i = 0; i < paletteSize; i++) {
		const distance =
			255 -
			Math.min(
				paletteChunk.data[i * 3],
				paletteChunk.data[i * 3 + 1],
				paletteChunk.data[i * 3 + 2],
			);
		isSeed.push(distance <= SEED_DISTANCE);
		isSpread.push(distance <= SPREAD_DISTANCE);
	}
	if (!isSeed.some(Boolean)) {
		return { png, clearedPixels: 0, skipped: "no white in palette" };
	}

	const { width, height, depth } = header;
	const rowBytes = Math.ceil((width * depth) / 8);
	const raw = zlib.inflateSync(
		concat(
			chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data),
		),
	);
	const indices = unpackIndices(
		unfilter(new Uint8Array(raw), rowBytes, height),
		rowBytes,
		header,
	);

	const background = floodFillBackground(indices, width, height, isSeed, isSpread);
	let clearedPixels = 0;
	const transparentIndex = paletteSize;
	for (let pixel = 0; pixel < indices.length; pixel++) {
		if (background[pixel]) {
			indices[pixel] = transparentIndex;
			clearedPixels++;
		}
	}
	if (clearedPixels === 0) {
		return { png, clearedPixels: 0, skipped: "no edge-connected white" };
	}

	// Re-emit at depth 8 with the None filter: palette indices gain nothing from
	// the predictive filters and deflate already collapses the flat background.
	const filtered = new Uint8Array((width + 1) * height);
	for (let y = 0; y < height; y++) {
		filtered[y * (width + 1)] = 0;
		filtered.set(
			indices.subarray(y * width, y * width + width),
			y * (width + 1) + 1,
		);
	}

	const newHeader = new Uint8Array(headerChunk.data);
	newHeader[8] = 8;

	const newPalette = new Uint8Array((paletteSize + 1) * 3);
	newPalette.set(paletteChunk.data.subarray(0, paletteSize * 3), 0);
	newPalette.fill(0xff, paletteSize * 3);

	const transparency = new Uint8Array(paletteSize + 1).fill(0xff);
	transparency[transparentIndex] = 0;

	const carried = chunks.filter((chunk) => !REBUILT_CHUNKS.has(chunk.type));

	return {
		png: concat([
			new Uint8Array(PNG_SIGNATURE),
			buildChunk("IHDR", newHeader),
			...carried.map((chunk) => buildChunk(chunk.type, chunk.data)),
			buildChunk("PLTE", newPalette),
			buildChunk("tRNS", transparency),
			// Uint8Array wrappers throughout: node types zlib's return as Buffer,
			// whose ArrayBufferLike backing store no longer satisfies Uint8Array.
			buildChunk("IDAT", new Uint8Array(zlib.deflateSync(filtered, { level: 9 }))),
			buildChunk("IEND", new Uint8Array(0)),
		]),
		clearedPixels,
	};
};
