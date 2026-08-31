import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { XMLParser } from "fast-xml-parser";

const { ESPN_NEWS_URL = "", MAIN_TABLE_NAME = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

interface NormalizedArticle {
	id: string;
	source: "ESPN" | "Bluesky" | "CBS" | "RealGM";
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

// Bluesky's NBA media presence is thin - most league/outlet accounts are
// registered but dormant. Only accounts verified to still post regularly are
// listed here; the MAX_ARTICLE_AGE guard below covers any that go quiet later.
const BLUESKY_NBA_ACCOUNTS = [
	"insidenbanews.bsky.social", // relays Shams/Scotto scoops
	"hoopsrumors.bsky.social", // link posts with embed cards
	"nba.com", // low volume, but official announcements
];

/**
 * Truncates on code points rather than UTF-16 units - substring() splits
 * emoji surrogate pairs and leaves a replacement glyph at the cut.
 */
const truncate = (text: string, max: number): string => {
	const chars = Array.from(text);
	return chars.length > max ? `${chars.slice(0, max).join("")}...` : text;
};

const fetchBluesky = async (): Promise<NormalizedArticle[]> => {
	const results = await Promise.all(
		BLUESKY_NBA_ACCOUNTS.map(async (actor) => {
			try {
				const res = await fetch(
					`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${actor}&limit=25&filter=posts_no_replies`,
				);
				if (!res.ok) return [];
				const data = await res.json();
				return (data.feed || [])
					.map((item: any): NormalizedArticle | null => {
						// A repost carries the original post's createdAt, so it would
						// sort into the wrong position in the feed.
						if (item.reason) return null;

						const post = item.post;
						const author = post?.author;
						const record = post?.record;
						if (!post?.uri || !author?.handle || !record?.createdAt) return null;

						const text: string = record.text || "";
						const external = post.embed?.external;
						// Link-only posts carry an empty text field - the embed card
						// holds the actual headline.
						const headline = text || external?.title || "Bluesky Post";
						const summary = text ? external?.description : undefined;

						return {
							id: post.uri,
							source: "Bluesky",
							headline: truncate(headline, 100),
							url: `https://bsky.app/profile/${author.handle}/post/${post.uri.split("/").pop()}`,
							author: `@${author.handle}`,
							publishedAt: record.createdAt,
							thumbnailUrl: external?.thumb || post.embed?.images?.[0]?.thumb,
							summary: summary ? truncate(summary, 200) : undefined,
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

interface RssFeedConfig {
	source: "CBS" | "RealGM";
	url: string;
	/** Fallback byline for feeds whose items carry no dc:creator. */
	defaultAuthor: string;
	/** Drop items whose link doesn't match - CBS mixes NFL/MLB into its NBA feed. */
	linkMustInclude?: string;
}

const RSS_FEEDS: RssFeedConfig[] = [
	{
		source: "CBS",
		url: "https://www.cbssports.com/rss/headlines/nba/",
		defaultAuthor: "CBS Sports",
		linkMustInclude: "/nba/",
	},
	{
		source: "RealGM",
		url: "https://basketball.realgm.com/rss/wiretap/0/0.xml",
		defaultAuthor: "RealGM",
	},
];

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	processEntities: true,
	// CBS titles carry numeric character references (&#039;, &#8217;). Without
	// htmlEntities these survive parsing and render literally on the card;
	// processEntities alone only covers the five predefined XML entities.
	htmlEntities: true,
});

/** RealGM wraps descriptions in markup; the card renders plain text only. */
const stripHtml = (html: string): string =>
	html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

/**
 * fast-xml-parser collapses a single <item> into an object rather than a
 * one-element array, and returns text nodes as numbers when they look numeric.
 */
const asArray = <T>(value: T | T[] | undefined): T[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

const asText = (value: any): string => {
	if (value === undefined || value === null) return "";
	if (typeof value === "object") return String(value["#text"] ?? "");
	return String(value);
};

const fetchRss = async (feed: RssFeedConfig): Promise<NormalizedArticle[]> => {
	try {
		const res = await fetch(feed.url, {
			headers: { "User-Agent": "team-builder-news-bot/1.0" },
		});
		if (!res.ok) {
			throw new Error(`${feed.source} feed failed: ${res.status}`);
		}
		const parsed = xmlParser.parse(await res.text());

		return asArray<any>(parsed?.rss?.channel?.item)
			.map((item): NormalizedArticle | null => {
				const url = asText(item.link);
				const headline = asText(item.title);
				if (!url || !headline) return null;

				// CBS publishes non-NBA stories to its NBA feed; the section path
				// in the link is the only reliable discriminator.
				if (feed.linkMustInclude && !url.includes(feed.linkMustInclude)) {
					return null;
				}

				const published = new Date(asText(item.pubDate)).getTime();
				if (Number.isNaN(published)) return null;

				const enclosure = item.enclosure;
				const thumbnailUrl = String(enclosure?.["@_type"] || "").startsWith("image/")
					? enclosure["@_url"]
					: undefined;

				const summary = stripHtml(asText(item.description));

				return {
					id: asText(item.guid) || url,
					source: feed.source,
					headline: truncate(headline, 120),
					url,
					author: asText(item["dc:creator"]) || feed.defaultAuthor,
					publishedAt: new Date(published).toISOString(),
					thumbnailUrl,
					summary: summary ? truncate(summary, 200) : undefined,
				};
			})
			.filter((a): a is NormalizedArticle => a !== null);
	} catch (e) {
		console.error(`${feed.source} Fetch Error`, e);
		return [];
	}
};

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export const handler: Handler = async (event, context): Promise<any> => {
	console.log("Fetching news from all sources...");

	const allNews = await Promise.all([
		fetchESPN(),
		fetchBluesky(),
		...RSS_FEEDS.map(fetchRss),
	]);

	// Feed endpoints return a fixed page count regardless of recency, so an
	// account that goes dormant would otherwise keep re-publishing years-old
	// posts as news. Anything already past the TTL horizon is dropped.
	const oldestAllowed = Date.now() - SEVEN_DAYS_SECONDS * 1000;
	const recent = allNews.flat().filter((article) => {
		const published = new Date(article.publishedAt).getTime();
		return !Number.isNaN(published) && published >= oldestAllowed;
	});

	// Outlets syndicate each other's wire stories, so the same article can arrive
	// from more than one source. First occurrence wins.
	const seenUrls = new Set<string>();
	const articles = recent.filter(({ url }) => {
		const key = url.split("?")[0].replace(/\/$/, "").toLowerCase();
		if (seenUrls.has(key)) return false;
		seenUrls.add(key);
		return true;
	});

	// PK: NEWS#{source}, SK: PUBLISHED_AT#{date}#ID#{id}
	// Partitioned per source so a high-volume source (ESPN) cannot consume the
	// entire read window and starve the others out of the feed.
	const ttl = Math.floor(Date.now() / 1000) + SEVEN_DAYS_SECONDS;
	const items = articles.map((article) => ({
		PK: `NEWS#${article.source}`,
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

	const countsBySource = articles.reduce<Record<string, number>>((acc, { source }) => {
		acc[source] = (acc[source] || 0) + 1;
		return acc;
	}, {});
	console.log(
		`Saved ${successCount}/${items.length} articles to ${MAIN_TABLE_NAME}`,
		JSON.stringify(countsBySource),
	);

	return {
		statusCode: 200,
		body: JSON.stringify({ message: "News fetched successfully", count: successCount }),
	};
};
