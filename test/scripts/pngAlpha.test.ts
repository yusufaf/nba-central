import { describe, it, expect } from "vitest";
import * as zlib from "zlib";
import { keyOutWhiteBackground } from "../../scripts/lib/pngAlpha";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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

const chunk = (type: string, data: Uint8Array) => {
	const out = new Uint8Array(data.length + 12);
	new DataView(out.buffer).setUint32(0, data.length);
	for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
	out.set(data, 8);
	new DataView(out.buffer).setUint32(
		data.length + 8,
		crc32(out.subarray(4, data.length + 8)),
	);
	return out;
};

const join = (parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
};

/**
 * Builds a depth-8 palette PNG from a grid of palette indices, matching the
 * shape Basketball-Reference serves: colour type 3, no tRNS, no interlacing.
 */
const buildPalettePng = (palette: number[][], pixels: number[][]) => {
	const height = pixels.length;
	const width = pixels[0].length;

	const ihdr = new Uint8Array(13);
	const view = new DataView(ihdr.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 3; // colour type: palette

	const plte = new Uint8Array(palette.length * 3);
	palette.forEach(([r, g, b], i) => {
		plte[i * 3] = r;
		plte[i * 3 + 1] = g;
		plte[i * 3 + 2] = b;
	});

	const raw = new Uint8Array((width + 1) * height);
	pixels.forEach((row, y) => {
		raw[y * (width + 1)] = 0; // filter: None
		row.forEach((index, x) => {
			raw[y * (width + 1) + 1 + x] = index;
		});
	});

	return join([
		new Uint8Array(SIGNATURE),
		chunk("IHDR", ihdr),
		chunk("PLTE", plte),
		chunk("IDAT", new Uint8Array(zlib.deflateSync(raw))),
		chunk("IEND", new Uint8Array(0)),
	]);
};

/** Reads a processed PNG back into { width, height, indices, transparentIndex }. */
const decode = (png: Uint8Array) => {
	let offset = 8;
	const idat: Uint8Array[] = [];
	let ihdr = new Uint8Array(0);
	let trnsLength = 0;
	const types: string[] = [];
	while (offset + 8 <= png.length) {
		const length = new DataView(png.buffer, png.byteOffset).getUint32(offset);
		const type = String.fromCharCode(
			png[offset + 4],
			png[offset + 5],
			png[offset + 6],
			png[offset + 7],
		);
		const data = png.subarray(offset + 8, offset + 8 + length);
		types.push(type);
		if (type === "IHDR") ihdr = data;
		if (type === "tRNS") trnsLength = length;
		if (type === "IDAT") idat.push(data);
		offset = offset + 8 + length + 4;
		if (type === "IEND") break;
	}
	const dv = new DataView(ihdr.buffer, ihdr.byteOffset);
	const width = dv.getUint32(0);
	const height = dv.getUint32(4);
	const raw = new Uint8Array(zlib.inflateSync(join(idat)));
	const indices: number[][] = [];
	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < width; x++) row.push(raw[y * (width + 1) + 1 + x]);
		indices.push(row);
	}
	return { width, height, indices, transparentIndex: trnsLength - 1, types };
};

// 0 white, 1 near-white (the JPEG-ish ringing BBRef's re-encodes carry),
// 2 dithered pale, 3 solid artwork colour.
const PALETTE = [
	[255, 255, 255],
	[252, 254, 252],
	[220, 235, 228],
	[10, 20, 30],
];

describe("keyOutWhiteBackground", () => {
	it("clears white that reaches the border and keeps white enclosed by artwork", () => {
		// A ring of artwork around a white centre, on a white background.
		const png = buildPalettePng(PALETTE, [
			[0, 0, 0, 0, 0],
			[0, 3, 3, 3, 0],
			[0, 3, 0, 3, 0],
			[0, 3, 3, 3, 0],
			[0, 0, 0, 0, 0],
		]);

		const { png: out, clearedPixels, skipped } = keyOutWhiteBackground(png);
		expect(skipped).toBeUndefined();

		const { indices, transparentIndex } = decode(out);
		expect(indices[0][0]).toBe(transparentIndex);
		expect(indices[2][2]).not.toBe(transparentIndex);
		expect(indices[1][1]).not.toBe(transparentIndex);
		expect(clearedPixels).toBe(16);
	});

	it("absorbs near-white ringing and dithered background reached from a white edge", () => {
		const png = buildPalettePng(PALETTE, [
			[0, 0, 1, 0, 0],
			[0, 1, 2, 1, 0],
			[2, 2, 3, 2, 2],
			[0, 1, 2, 1, 0],
			[0, 0, 1, 0, 0],
		]);

		const { clearedPixels } = keyOutWhiteBackground(png);
		expect(clearedPixels).toBe(24);
	});

	it("does not start the fill from a border pixel that is merely pale", () => {
		// Every border pixel is the dithered pale entry, which may be spread
		// through but never seeded from, so nothing should be cleared.
		const png = buildPalettePng(PALETTE, [
			[2, 2, 2],
			[2, 0, 2],
			[2, 2, 2],
		]);

		const result = keyOutWhiteBackground(png);
		expect(result.clearedPixels).toBe(0);
		expect(result.skipped).toBe("no edge-connected white");
		expect(result.png).toBe(png);
	});

	it("is idempotent - a second pass leaves an already-keyed image alone", () => {
		const png = buildPalettePng(PALETTE, [
			[0, 0, 0],
			[0, 3, 0],
			[0, 0, 0],
		]);

		const first = keyOutWhiteBackground(png);
		const second = keyOutWhiteBackground(first.png);
		expect(second.skipped).toBe("already has transparency");
		expect(second.png).toBe(first.png);
	});

	it("emits a valid chunk order with tRNS after PLTE", () => {
		const png = buildPalettePng(PALETTE, [
			[0, 0],
			[0, 3],
		]);

		const { types } = decode(keyOutWhiteBackground(png).png);
		expect(types).toEqual(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);
	});

	it("leaves anything that is not an opaque palette PNG untouched", () => {
		const notAPng = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(keyOutWhiteBackground(notAPng).skipped).toBe("not a PNG");
	});
});
