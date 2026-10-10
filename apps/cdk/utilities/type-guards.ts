export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
	(options as readonly unknown[]).includes(value);
