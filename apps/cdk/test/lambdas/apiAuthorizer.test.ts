import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { APIGatewayRequestAuthorizerEvent } from "aws-lambda";

// Exercises the real cryptographic verify path (jose's jwtVerify against a
// real ES384 key pair and a real JWKS document), the same as production —
// only the network transport is a local HTTP server instead of Logto itself,
// since hitting the live logto-af.fly.dev instance on every test run isn't
// viable. The live instance is verified separately (see the auth migration
// plan's Phase 2 gate).
//
// The module under test reads `logtoEndpoint`/`apiResource` from
// process.env and derives the issuer/JWKS URL at import time, so each test
// sets the env vars and dynamically imports a fresh module instance via
// vi.resetModules().

const ISSUER_PATH = "/oidc";
const AUDIENCE = "https://api.nba.yusufaf.dev";
const KEY_ID = "test-key-1";

let server: Server;
let endpoint: string;
let privateKey: CryptoKey;

const startJwksServer = async () => {
	const { publicKey, privateKey: generatedPrivateKey } = await generateKeyPair(
		"ES384",
	);
	privateKey = generatedPrivateKey;
	const jwk = await exportJWK(publicKey);
	jwk.kid = KEY_ID;
	jwk.alg = "ES384";
	jwk.use = "sig";

	server = createServer((req, res) => {
		if (req.url === `${ISSUER_PATH}/jwks`) {
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ keys: [jwk] }));
			return;
		}
		res.writeHead(404);
		res.end();
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	endpoint = `http://127.0.0.1:${port}`;
};

const signToken = async (
	claims: Record<string, unknown>,
	{ issuer = `${endpoint}${ISSUER_PATH}`, audience = AUDIENCE, expired = false } = {},
) => {
	const jwt = new SignJWT(claims)
		.setProtectedHeader({ alg: "ES384", kid: KEY_ID })
		.setIssuedAt()
		.setIssuer(issuer)
		.setAudience(audience)
		.setExpirationTime(expired ? "-1h" : "1h");
	return jwt.sign(privateKey);
};

const buildEvent = (
	authorization?: string,
): APIGatewayRequestAuthorizerEvent =>
	({
		headers: authorization ? { Authorization: authorization } : {},
	}) as unknown as APIGatewayRequestAuthorizerEvent;

const loadHandler = async () => {
	// The module derives its issuer/JWKS URL from process.env once, at
	// import time — same as a real Lambda cold start — and every test here
	// runs against the same local JWKS server/audience, so a single cached
	// import is reused across tests; only the signed token itself varies.
	const mod = await import("lambdas/apiAuthorizer/src/apiAuthorizer");
	return mod.handler;
};

beforeAll(async () => {
	await startJwksServer();
	process.env.logtoEndpoint = endpoint;
	process.env.apiResource = AUDIENCE;
});

afterAll(() => {
	server.close();
});

describe("apiAuthorizer", () => {
	it("authorizes a valid token and populates username/sub from its claims", async () => {
		const token = await signToken({ sub: "user-123", username: "yusufaf" });
		const handler = await loadHandler();

		const result = (await handler(
			buildEvent(`Bearer ${token}`),
			{} as any,
			{} as any,
		)) as any;

		expect(result.isAuthorized).toBe(true);
		expect(result.context).toMatchObject({
			sub: "user-123",
			username: "yusufaf",
		});
	});

	it("rejects a token issued for a different project's API resource", async () => {
		const token = await signToken(
			{ sub: "user-123", username: "yusufaf" },
			{ audience: "https://api.quizaroni.yusufaf.dev" },
		);
		const handler = await loadHandler();

		const result = (await handler(
			buildEvent(`Bearer ${token}`),
			{} as any,
			{} as any,
		)) as any;

		expect(result.isAuthorized).toBe(false);
	});

	it("rejects an expired token", async () => {
		const token = await signToken(
			{ sub: "user-123", username: "yusufaf" },
			{ expired: true },
		);
		const handler = await loadHandler();

		const result = (await handler(
			buildEvent(`Bearer ${token}`),
			{} as any,
			{} as any,
		)) as any;

		expect(result.isAuthorized).toBe(false);
	});

	it("rejects a token from an unrecognized issuer", async () => {
		const token = await signToken(
			{ sub: "user-123", username: "yusufaf" },
			{ issuer: "https://not-logto.example.com/oidc" },
		);
		const handler = await loadHandler();

		const result = (await handler(
			buildEvent(`Bearer ${token}`),
			{} as any,
			{} as any,
		)) as any;

		expect(result.isAuthorized).toBe(false);
	});

	it("rejects a request with no Authorization header", async () => {
		const handler = await loadHandler();

		const result = (await handler(
			buildEvent(),
			{} as any,
			{} as any,
		)) as any;

		expect(result.isAuthorized).toBe(false);
	});
});
