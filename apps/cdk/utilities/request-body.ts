// The S3 upload Lambdas parse `event.body` themselves rather than going
// through a request validator, so anything wrong with the body has to be
// turned into a 400 here. Without this the failures land in the handler's
// generic catch (500) or, when the parse itself throws, outside it entirely
// (a bodyless 502 from API Gateway).

export type FieldType = "string" | "number" | "array";

export type ParsedBody<T> =
	| { valid: true; body: T }
	| { valid: false; error: string };

const matchesType = (value: unknown, type: FieldType): boolean => {
	if (type === "array") return Array.isArray(value);
	// Strings that are present but empty produce keys like "a//b", so they are
	// treated as missing rather than passed on to S3.
	if (type === "string") return typeof value === "string" && value.length > 0;
	return typeof value === "number" && Number.isFinite(value);
};

export const parseRequestBody = <T>(
	rawBody: string | undefined,
	fields: Record<string, FieldType>,
): ParsedBody<T> => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawBody ?? "");
	} catch {
		return { valid: false, error: "Invalid request body" };
	}

	// `JSON.parse` happily returns null, a number or an array; destructuring
	// those throws a TypeError further down.
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return { valid: false, error: "Invalid request body" };
	}

	const record = parsed as Record<string, unknown>;
	const invalid = Object.keys(fields).filter(
		(field) => !matchesType(record[field], fields[field]),
	);
	if (invalid.length > 0) {
		return {
			valid: false,
			error: `Missing or invalid field(s): ${invalid.join(", ")}`,
		};
	}

	return { valid: true, body: parsed as T };
};
