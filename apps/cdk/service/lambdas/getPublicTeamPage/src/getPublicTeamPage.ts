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
const SHELL_TTL_MS = 5 * 60 * 1000;
let shellCache: { html: string; fetchedAt: number } | null = null;

export const __resetShellCache = () => {
	shellCache = null;
};

const loadShell = async (): Promise<string> => {
	if (shellCache && Date.now() - shellCache.fetchedAt < SHELL_TTL_MS) {
		return shellCache.html;
	}
	const object = await s3Client.send(
		new GetObjectCommand({ Bucket: webBucket, Key: "index.html" }),
	);
	const html = (await object.Body?.transformToString()) ?? "";
	shellCache = { html, fetchedAt: Date.now() };
	return html;
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
