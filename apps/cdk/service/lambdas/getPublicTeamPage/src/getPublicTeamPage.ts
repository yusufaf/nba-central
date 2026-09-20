import {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { queryPublicTeam } from "resources/dynamo/teams";
import { injectOgTags } from "utilities/og-html";

const { mainTable = "", webBucket = "", siteUrl = "" } = process.env;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3Client = new S3Client({});

// Crawlers don't run JavaScript, so the OG tags have to be in the HTML they
// fetch. This serves the deployed SPA shell (index.html, hashed asset URLs
// and all) with the tags injected; the browser then boots Vue exactly as it
// would from S3 and vue-router renders /t/:teamUUID.
//
// `s3 sync --delete` in the deploy workflow removes the previous build's
// hashed /assets/*.js the moment a new one lands, so a shell cached by
// content (not revalidated) can outlive the assets it references and 404 a
// warm Lambda's callers. A conditional GET is cheap, so instead of a TTL we
// revalidate by ETag on every call and only pay for a fresh body on a real
// change (a 304 skips the download).
let shellCache: { html: string; etag: string } | null = null;

export const __resetShellCache = () => {
	shellCache = null;
};

const isNotModifiedError = (err: unknown): boolean => {
	if (!err || typeof err !== "object") return false;
	const { name, $metadata } = err as { name?: string; $metadata?: { httpStatusCode?: number } };
	return $metadata?.httpStatusCode === 304 || name === "NotModified" || name === "304";
};

const loadShell = async (): Promise<string> => {
	try {
		const object = await s3Client.send(
			new GetObjectCommand({
				Bucket: webBucket,
				Key: "index.html",
				...(shellCache ? { IfNoneMatch: shellCache.etag } : {}),
			}),
		);
		const shellHtml = (await object.Body?.transformToString()) ?? "";
		// An empty body means the object is missing or truncated - either way it
		// isn't a shell worth serving or caching.
		if (!shellHtml) throw new Error("index.html is empty");
		shellCache = { html: shellHtml, etag: object.ETag ?? "" };
		return shellCache.html;
	} catch (err) {
		// A 304 means our cached copy is still current - the SDK surfaces it as
		// a rejection rather than a normal response.
		if (shellCache && isNotModifiedError(err)) return shellCache.html;
		throw err;
	}
};

const html = (body: string): APIGatewayProxyResultV2 => ({
	statusCode: 200,
	headers: {
		"content-type": "text/html; charset=utf-8",
		"cache-control": "public, max-age=60, s-maxage=300",
	},
	body,
});

export const handler: Handler = async (
	event: APIGatewayProxyEventV2,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const teamUUID = event.pathParameters?.teamUUID || "";

	let shell: string;
	try {
		shell = await loadShell();
	} catch (err) {
		// No shell means the site itself is broken; say so instead of
		// pretending the team is missing.
		console.error("Error loading SPA shell:", err);
		return {
			statusCode: 500,
			headers: { "content-type": "text/plain; charset=utf-8" },
			body: "Site unavailable",
		};
	}

	try {
		const team = teamUUID ? await queryPublicTeam(docClient, mainTable, teamUUID) : null;
		// Unknown or private: plain shell, and the SPA shows its own 404.
		if (!team) return html(shell);
		return html(injectOgTags(shell, team, siteUrl));
	} catch (err) {
		console.error("Error building public team page:", err);
		return html(shell);
	}
};
