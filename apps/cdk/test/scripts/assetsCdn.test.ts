import { describe, it, expect, vi } from "vitest";
import { HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { uploadIfMissing } from "../../scripts/lib/assetsCdn";

const fake = (...results: unknown[]) => {
	const send = vi.fn();
	for (const r of results) {
		if (r instanceof Error) send.mockRejectedValueOnce(r);
		else send.mockResolvedValueOnce(r);
	}
	return {
		send,
		upload: { s3Client: { send } as unknown as S3Client, bucketName: "bucket", distributionDomain: "cdn.example" },
	};
};

const s3Error = (status: number) =>
	Object.assign(new Error(String(status)), { $metadata: { httpStatusCode: status } });

const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe("uploadIfMissing", () => {
	it("skips the upload when an object already sits at the key", async () => {
		const { send, upload } = fake({});
		await expect(uploadIfMissing(upload, "k.png", bytes, "image/png")).resolves.toBe(false);
		expect(send).toHaveBeenCalledTimes(1);
		const head = send.mock.calls[0][0];
		expect(head).toBeInstanceOf(HeadObjectCommand);
		expect(head.input).toEqual({ Bucket: "bucket", Key: "k.png" });
	});

	it("uploads with an immutable cache header when the key is missing", async () => {
		const { send, upload } = fake(s3Error(404), {});
		await expect(uploadIfMissing(upload, "k.png", bytes, "image/png")).resolves.toBe(true);
		const put = send.mock.calls[1][0];
		expect(put).toBeInstanceOf(PutObjectCommand);
		expect(put.input).toEqual({
			Bucket: "bucket",
			Key: "k.png",
			Body: bytes,
			ContentType: "image/png",
			CacheControl: "public, max-age=31536000, immutable",
		});
	});

	it("treats a 403 as missing (no s3:ListBucket)", async () => {
		const { upload } = fake(s3Error(403), {});
		await expect(uploadIfMissing(upload, "k.png", bytes, "image/png")).resolves.toBe(true);
	});

	it("rethrows any other HEAD failure", async () => {
		const { send, upload } = fake(s3Error(500));
		await expect(uploadIfMissing(upload, "k.png", bytes, "image/png")).rejects.toThrow("500");
		expect(send).toHaveBeenCalledTimes(1);
	});
});
