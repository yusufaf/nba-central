import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/client-ses", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-ses")>();
	return {
		...actual,
		SESClient: class {
			send = send;
		},
	};
});

process.env.FEEDBACK_SES_REGION = "us-east-1";
process.env.FEEDBACK_FROM_ADDRESS = "feedback@auth.yusufaf.dev";
process.env.FEEDBACK_TO_ADDRESS = "owner@example.com";

const { handler } = await import("lambdas/sendFeedback/src/sendFeedback");

const invoke = (
	body: string | undefined,
	auth: { sub?: string; username?: string } = {
		sub: "user-1",
		username: "yusuf",
	},
) =>
	handler(
		{ body, requestContext: { authorizer: { lambda: auth } } } as any,
		{} as any,
		{} as any,
	) as Promise<any>;

beforeEach(() => {
	send.mockReset();
});

describe("sendFeedback", () => {
	it("sends the feedback email", async () => {
		send.mockResolvedValueOnce({ MessageId: "msg-1" });

		const result = await invoke(
			JSON.stringify({
				message: "Love the app",
				subject: "Compliment",
				email: "fan@example.com",
			}),
		);

		expect(result.statusCode).toBe(200);
		expect(JSON.parse(result.body)).toEqual({
			success: true,
			data: { messageId: "msg-1" },
		});

		const input = send.mock.calls[0][0].input;
		expect(input.Source).toBe("feedback@auth.yusufaf.dev");
		expect(input.Destination.ToAddresses).toEqual(["owner@example.com"]);
		expect(input.ReplyToAddresses).toEqual(["fan@example.com"]);
		expect(input.Message.Subject.Data).toBe("[NBA Central] Compliment");
		expect(input.Message.Body.Text.Data).toContain("Love the app");
		expect(input.Message.Body.Text.Data).toContain("yusuf");
		expect(input.Message.Body.Text.Data).toContain("user-1");
	});

	it("omits ReplyToAddresses when no email is given", async () => {
		send.mockResolvedValueOnce({ MessageId: "msg-2" });

		const result = await invoke(JSON.stringify({ message: "No reply needed" }));

		expect(result.statusCode).toBe(200);
		expect(send.mock.calls[0][0].input.ReplyToAddresses).toBeUndefined();
	});

	it("treats an empty-string email as not provided, not invalid", async () => {
		send.mockResolvedValueOnce({ MessageId: "msg-3" });

		const result = await invoke(
			JSON.stringify({ message: "Blank email field", email: "" }),
		);

		expect(result.statusCode).toBe(200);
		expect(send.mock.calls[0][0].input.ReplyToAddresses).toBeUndefined();
	});

	it("400s when the request body is missing", async () => {
		const result = await invoke(undefined);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body)).toEqual({
			success: false,
			error: "Invalid request body",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when the request body is not valid JSON", async () => {
		const result = await invoke("{oops");

		expect(result.statusCode).toBe(400);
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when the request body parses to null", async () => {
		const result = await invoke("null");

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body)).toEqual({
			success: false,
			error: "Invalid request body",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when message is missing", async () => {
		const result = await invoke(JSON.stringify({ subject: "Hi" }));

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body)).toEqual({
			success: false,
			error: "Missing or invalid field(s): message",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when message is over the length cap", async () => {
		const result = await invoke(
			JSON.stringify({ message: "a".repeat(5001) }),
		);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).error).toBe(
			"message must be 5000 characters or fewer",
		);
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when subject is over the length cap", async () => {
		const result = await invoke(
			JSON.stringify({ message: "hi", subject: "a".repeat(201) }),
		);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).error).toBe(
			"subject must be 200 characters or fewer",
		);
		expect(send).not.toHaveBeenCalled();
	});

	it("400s when email is malformed", async () => {
		const result = await invoke(
			JSON.stringify({ message: "hi", email: "not-an-email" }),
		);

		expect(result.statusCode).toBe(400);
		expect(JSON.parse(result.body).error).toBe(
			"email must be a valid email address",
		);
		expect(send).not.toHaveBeenCalled();
	});

	it("403s when the caller has no sub", async () => {
		const result = await invoke(JSON.stringify({ message: "hi" }), {});

		expect(result.statusCode).toBe(403);
		expect(JSON.parse(result.body)).toEqual({
			success: false,
			error: "Forbidden",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("500s when the send fails", async () => {
		send.mockRejectedValueOnce(new Error("MessageRejected"));

		const result = await invoke(JSON.stringify({ message: "hi" }));

		expect(result.statusCode).toBe(500);
		expect(JSON.parse(result.body)).toEqual({
			success: false,
			error: "MessageRejected",
		});
	});
});
