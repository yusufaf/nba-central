import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return {
		...actual,
		S3Client: class {
			send = send;
		},
	};
});

process.env.mainBucket = "test-bucket";

const { handler } = await import("lambdas/deleteFile/src/deleteFile");

const invokeWithBody = (body?: string, sub: string | undefined = "user-1") =>
	handler(
		{ body, requestContext: { authorizer: { lambda: { sub } } } } as any,
		{} as any,
		{} as any,
	) as Promise<any>;

beforeEach(() => {
	send.mockReset();
});

describe("deleteFile", () => {
	it("deletes the requested key", async () => {
		send.mockResolvedValueOnce({});

		const result = await invokeWithBody(
			JSON.stringify({ key: "uploads/user-1/photo.png" }),
		);

		expect(result.statusCode).toBe(200);
		expect(send.mock.calls[0][0].input).toMatchObject({
			Bucket: "test-bucket",
			Key: "uploads/user-1/photo.png",
		});
	});

	it("400s when the request body is missing", async () => {
		const result = await invokeWithBody(undefined);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body)).toEqual({
			message: "Invalid request body",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when the request body is not valid JSON", async () => {
		const result = await invokeWithBody("{oops");

		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when the key is missing", async () => {
		const result = await invokeWithBody(JSON.stringify({}));

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).message).toBe(
			"Missing or invalid field(s): key",
		);
		expect(send).not.toHaveBeenCalled();
	});

	it("403s when the key belongs to a different user", async () => {
		const result = await invokeWithBody(
			JSON.stringify({ key: "uploads/user-2/photo.png" }),
		);

		expect(result.statusCode).toBe(403);
		expect(JSON.parse(result.body)).toEqual({ message: "Forbidden" });
		expect(send).not.toHaveBeenCalled();
	});

	it("403s when the caller has no sub", async () => {
		const result = await handler(
			{
				body: JSON.stringify({ key: "uploads/user-1/photo.png" }),
				requestContext: { authorizer: { lambda: {} } },
			} as any,
			{} as any,
			{} as any,
		) as any;

		expect(result.statusCode).toBe(403);
		expect(send).not.toHaveBeenCalled();
	});

	it("500s when the delete fails", async () => {
		send.mockRejectedValueOnce(new Error("AccessDenied"));

		const result = await invokeWithBody(
			JSON.stringify({ key: "uploads/user-1/photo.png" }),
		);

		expect(result.statusCode).toBe(500);
		expect(JSON.parse(result.body)).toEqual({
			message: "Error deleting file",
		});
	});
});
