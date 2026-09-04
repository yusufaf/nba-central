import { describe, it, expect } from "vitest";
import { isOwnedKey, parseRequestBody } from "utilities/request-body";

type Body = {
	key: string;
	numParts: number;
	parts: string[];
};

const fields = {
	key: "string",
	numParts: "number",
	parts: "array",
} as const;

const parse = (rawBody: string | undefined) =>
	parseRequestBody<Body>(rawBody, { ...fields });

describe("parseRequestBody", () => {
	it("returns the parsed body when every field is present and well typed", () => {
		const result = parse(
			JSON.stringify({ key: "a/b.png", numParts: 2, parts: ["etag"] }),
		);

		expect(result).toEqual({
			valid: true,
			body: { key: "a/b.png", numParts: 2, parts: ["etag"] },
		});
	});

	it("keeps fields that were not declared", () => {
		const result = parse(
			JSON.stringify({
				key: "a/b.png",
				numParts: 1,
				parts: [],
				contentType: "image/png",
			}),
		);

		expect(result.valid && (result.body as any).contentType).toBe("image/png");
	});

	it.each([
		["undefined", undefined],
		["an empty string", ""],
		["unparseable JSON", "{oops"],
		["null", "null"],
		["a number", "42"],
		["an array", "[]"],
	])("rejects %s as an invalid body", (_label, rawBody) => {
		expect(parse(rawBody)).toEqual({
			valid: false,
			error: "Invalid request body",
		});
	});

	it("lists every missing or mistyped field", () => {
		const result = parse(JSON.stringify({ numParts: "2", parts: {} }));

		expect(result).toEqual({
			valid: false,
			error: "Missing or invalid field(s): key, numParts, parts",
		});
	});

	it("treats an empty string as missing", () => {
		const result = parse(
			JSON.stringify({ key: "", numParts: 1, parts: [] }),
		);

		expect(result).toEqual({
			valid: false,
			error: "Missing or invalid field(s): key",
		});
	});

	it("rejects null for a number field", () => {
		// JSON.stringify turns NaN and Infinity into null, so null is how a
		// non-finite number actually arrives.
		const result = parseRequestBody<Body>(
			JSON.stringify({ numParts: NaN }),
			{ numParts: "number" },
		);

		expect(result).toEqual({
			valid: false,
			error: "Missing or invalid field(s): numParts",
		});
	});
});

describe("isOwnedKey", () => {
	it("is true when the key's owner segment matches the caller's sub", () => {
		expect(isOwnedKey("studyset-1/user-1/photo.png", "user-1")).toBe(true);
	});

	it("is false when the key's owner segment belongs to someone else", () => {
		expect(isOwnedKey("studyset-1/user-1/photo.png", "user-2")).toBe(false);
	});

	it("is false when the key has no owner segment", () => {
		expect(isOwnedKey("photo.png", "user-1")).toBe(false);
	});

	it("is false when there is no caller sub", () => {
		expect(isOwnedKey("studyset-1/user-1/photo.png", undefined)).toBe(false);
	});
});
