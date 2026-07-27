import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const { ESPN_NEWS_URL = "", MAIN_TABLE_NAME = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface NormalizedArticle {
	id: string;
	source: "ESPN" | "Reddit" | "Bluesky";
	headline: string;
	url: string;
	author: string;
	publishedAt: string;
	thumbnailUrl?: string;
	summary?: string;
}

const fetchESPN = async (): Promise<NormalizedArticle[]> => {
	try {
		const res = await fetch(ESPN_NEWS_URL);
		const data = await res.json();
		return (data.articles || [])
			.map((article: any): NormalizedArticle | null => {
				const id = article.dataSourceIdentifier || article.links?.web?.href;
				if (!id || !article.headline || !article.published) return null;
				return {
					id,
					source: "ESPN",
					headline: article.headline,
					url: article.links?.web?.href || "",
					author: article.byline || "ESPN Staff",
					publishedAt: article.published,
					thumbnailUrl: article.images?.[0]?.url,
					summary: article.description,
				};
			})
			.filter((a: NormalizedArticle | null): a is NormalizedArticle => a !== null);
	} catch (e) {
		console.error("ESPN Fetch Error", e);
		return [];
	}
};

const fetchReddit = async (): Promise<NormalizedArticle[]> => {
	try {
		const res = await fetch("https://www.reddit.com/r/nba/hot.json?limit=15", {
			headers: { "User-Agent": "team-builder-news-bot/1.0" },
		});
		const data = await res.json();
		return (data.data?.children || [])
			.map((child: any): NormalizedArticle | null => {
				const post = child.data;
				if (!post?.id || !post.title || !post.created_utc) return null;
				let thumbnailUrl: string | undefined = post.thumbnail;
				if (
					!thumbnailUrl ||
					thumbnailUrl === "self" ||
					thumbnailUrl === "default" ||
					thumbnailUrl === "nsfw" ||
					thumbnailUrl === "spoiler" ||
					!thumbnailUrl.startsWith("http")
				) {
					thumbnailUrl = undefined;
				}
				return {
					id: post.id,
					source: "Reddit",
					headline: post.title,
					url: `https://reddit.com${post.permalink}`,
					author: `u/${post.author}`,
					publishedAt: new Date(post.created_utc * 1000).toISOString(),
					thumbnailUrl,
					summary: post.selftext ? post.selftext.substring(0, 150) + "..." : undefined,
				};
			})
			.filter((a: NormalizedArticle | null): a is NormalizedArticle => a !== null);
	} catch (e) {
		console.error("Reddit Fetch Error", e);
		return [];
	}
};

const BLUESKY_NBA_ACCOUNTS = [
	"shams.bsky.social",
	"wojespn.bsky.social",
	"nba.com",
];

const fetchBluesky = async (): Promise<NormalizedArticle[]> => {
	const results = await Promise.all(
		BLUESKY_NBA_ACCOUNTS.map(async (actor) => {
			try {
				const res = await fetch(
					`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${actor}&limit=10`,
				);
				if (!res.ok) return [];
				const data = await res.json();
				return (data.feed || [])
					.map((item: any): NormalizedArticle | null => {
						const post = item.post;
						const author = post?.author;
						const record = post?.record;
						if (!post?.uri || !author?.handle || !record?.createdAt) return null;
						const text: string = record.text || "";
						return {
							id: post.uri,
							source: "Bluesky",
							headline: text ? text.substring(0, 100) + (text.length > 100 ? "..." : "") : "Bluesky Post",
							url: `https://bsky.app/profile/${author.handle}/post/${post.uri.split("/").pop()}`,
							author: `@${author.handle}`,
							publishedAt: record.createdAt,
							summary: text || undefined,
						};
					})
					.filter((a: NormalizedArticle | null): a is NormalizedArticle => a !== null);
			} catch (e) {
				console.error(`Bluesky Fetch Error (${actor})`, e);
				return [];
			}
		}),
	);
	return results.flat();
};

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export const handler: Handler = async (event, context): Promise<any> => {
	console.log("Fetching news from all sources...");

	const allNews = await Promise.all([fetchESPN(), fetchReddit(), fetchBluesky()]);
	const articles = allNews.flat();

	// PK: NEWS, SK: PUBLISHED_AT#{date}#ID#{id}
	const ttl = Math.floor(Date.now() / 1000) + SEVEN_DAYS_SECONDS;
	const items = articles.map((article) => ({
		PK: "NEWS",
		SK: `PUBLISHED_AT#${article.publishedAt}#ID#${article.id}`,
		...article,
		ttl,
	}));

	let successCount = 0;
	for (let i = 0; i < items.length; i += 25) {
		const chunk = items.slice(i, i + 25);
		try {
			await docClient.send(
				new BatchWriteCommand({
					RequestItems: {
						[MAIN_TABLE_NAME]: chunk.map((Item) => ({ PutRequest: { Item } })),
					},
				}),
			);
			successCount += chunk.length;
		} catch (e) {
			console.error("DynamoDB BatchWrite Error", e);
		}
	}

	console.log(`Saved ${successCount}/${items.length} articles to ${MAIN_TABLE_NAME}`);

	return {
		statusCode: 200,
		body: JSON.stringify({ message: "News fetched successfully", count: successCount }),
	};
};
