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
	"lambdas/completeMultipartUpload/src/completeMultipartUpload"
);

const uploadEvent = (key: string) => ({
	body: JSON.stringify({
		key,
		uploadId: "upload-1",
		parts: [{ ETag: "etag-1", PartNumber: 1 }],
	}),
});

const invoke = (key: string) =>
	handler(uploadEvent(key) as any, {} as any, {} as any) as Promise<any>;

beforeEach(() => {
	send.mockReset();
	getSignedUrl.mockReset();
	getSignedUrl.mockResolvedValue("https://signed.example/photo.png");
});

describe("completeMultipartUpload", () => {
	it("returns the full file name and a resolved signed URL", async () => {
		send.mockResolvedValueOnce({});
		send.mockResolvedValueOnce({ ContentLength: 12345 });

		const result = await invoke("uploads/user-1/photo.png");

		expect(result.statusCode).toBe(200);
		expect(JSON.parse(result.body)).toEqual({
			name: "photo.png",
			key: "uploads/user-1/photo.png",
			size: 12345,
			signedURL: "https://signed.example/photo.png",
		});
	});

	it("completes the upload with the requested key, upload id and parts", async () => {
		send.mockResolvedValueOnce({});
		send.mockResolvedValueOnce({ ContentLength: 1 });

		await invoke("uploads/user-1/photo.png");

		const completeInput = send.mock.calls[0][0].input;
		expect(completeInput).toMatchObject({
			Bucket: "test-bucket",
			Key: "uploads/user-1/photo.png",
			UploadId: "upload-1",
			MultipartUpload: { Parts: [{ ETag: "etag-1", PartNumber: 1 }] },
		});
	});

	it("falls back to a zero size when S3 reports no content length", async () => {
		send.mockResolvedValueOnce({});
		send.mockResolvedValueOnce({});

		const result = await invoke("photo.png");

		expect(JSON.parse(result.body).size).toBe(0);
	});

	it("500s when completing the upload fails", async () => {
		send.mockRejectedValueOnce(new Error("NoSuchUpload"));

		const result = await invoke("uploads/user-1/photo.png");

		expect(result.statusCode).toBe(500);
		expect(JSON.parse(result.body)).toEqual({ message: "Error" });
	});
});
