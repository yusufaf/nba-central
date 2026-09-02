import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
const getSignedUrl = vi.fn();

vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
	return {
		...actual,
		S3Client: class {
			send = send;
		},
	};
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: (...args: any[]) => getSignedUrl(...args),
}));

process.env.mainBucket = "test-bucket";

const { handler } = await import(
	"lambdas/getMultipartSignedUploadUrls/src/getMultipartSignedUploadUrls"
);

const invokeWithBody = (body?: string) =>
	handler({ body } as any, {} as any, {} as any) as Promise<any>;

beforeEach(() => {
	send.mockReset();
	getSignedUrl.mockReset();
});

describe("getMultipartSignedUploadUrls", () => {
	it("returns one signed URL per part", async () => {
		getSignedUrl
			.mockResolvedValueOnce("https://signed.example/part-1")
			.mockResolvedValueOnce("https://signed.example/part-2");

		const result = await invokeWithBody(
			JSON.stringify({
				key: "uploads/user-1/photo.png",
				uploadId: "upload-1",
				numParts: 2,
			}),
		);

		expect(result.statusCode).toBe(200);
		expect(JSON.parse(result.body)).toEqual({
			signedURLs: {
				0: "https://signed.example/part-1",
				1: "https://signed.example/part-2",
			},
		});
	});

	it("400s when the request body is missing", async () => {
		const result = await invokeWithBody(undefined);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body)).toEqual({
			message: "Invalid request body",
		});
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	it("400s when the request body is not valid JSON", async () => {
		const result = await invokeWithBody("{oops");

		expect(result.statusCode).toBe(400);
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	it("400s when numParts is not a number", async () => {
		const result = await invokeWithBody(
			JSON.stringify({
				key: "uploads/user-1/photo.png",
				uploadId: "upload-1",
				numParts: "2",
			}),
		);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).message).toBe(
			"Missing or invalid field(s): numParts",
		);
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	it("400s when numParts is outside S3's part limit", async () => {
		const result = await invokeWithBody(
			JSON.stringify({
				key: "uploads/user-1/photo.png",
				uploadId: "upload-1",
				numParts: 10001,
			}),
		);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).message).toBe(
			"numParts must be an integer between 1 and 10000",
		);
		expect(getSignedUrl).not.toHaveBeenCalled();
	});

	it("500s when signing a part fails", async () => {
		getSignedUrl.mockRejectedValueOnce(new Error("AccessDenied"));

		const result = await invokeWithBody(
			JSON.stringify({
				key: "uploads/user-1/photo.png",
				uploadId: "upload-1",
				numParts: 1,
			}),
		);

		expect(result.statusCode).toBe(500);
		expect(JSON.parse(result.body)).toEqual({ message: "Error" });
	});
});
