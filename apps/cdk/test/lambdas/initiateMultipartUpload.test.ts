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

const { handler } = await import(
	"lambdas/initiateMultipartUpload/src/initiateMultipartUpload"
);

const invokeWithBody = (body?: string) =>
	handler({ body } as any, {} as any, {} as any) as Promise<any>;

beforeEach(() => {
	send.mockReset();
});

describe("initiateMultipartUpload", () => {
	it("returns the key and upload id", async () => {
		send.mockResolvedValueOnce({ UploadId: "upload-1" });

		const result = await invokeWithBody(
			JSON.stringify({
				studysetUUID: "studyset-1",
				userUUID: "user-1",
				fileName: "photo.png",
				contentType: "image/png",
			}),
		);

		expect(result.statusCode).toBe(200);
		expect(JSON.parse(result.body)).toEqual({
			key: "studyset-1/user-1/photo.png",
			uploadId: "upload-1",
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

	it("400s rather than building an 'undefined/undefined/undefined' key", async () => {
		const result = await invokeWithBody(JSON.stringify({}));

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).message).toBe(
			"Missing or invalid field(s): studysetUUID, userUUID, fileName",
		);
		expect(send).not.toHaveBeenCalled();
	});

	it("does not require a content type", async () => {
		send.mockResolvedValueOnce({ UploadId: "upload-1" });

		const result = await invokeWithBody(
			JSON.stringify({
				studysetUUID: "studyset-1",
				userUUID: "user-1",
				fileName: "photo.png",
			}),
		);

		expect(result.statusCode).toBe(200);
	});

	it("500s when creating the multipart upload fails", async () => {
		send.mockRejectedValueOnce(new Error("AccessDenied"));

		const result = await invokeWithBody(
			JSON.stringify({
				studysetUUID: "studyset-1",
				userUUID: "user-1",
				fileName: "photo.png",
				contentType: "image/png",
			}),
		);

		expect(result.statusCode).toBe(500);
		expect(JSON.parse(result.body)).toEqual({ message: "Error" });
	});
});
