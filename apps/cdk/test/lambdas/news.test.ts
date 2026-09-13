import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/lib-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/lib-dynamodb")>();
	return {
		...actual,
		DynamoDBDocumentClient: {
			from: () => ({ send }),
		},
	};
});

vi.mock("@aws-sdk/client-dynamodb", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@aws-sdk/client-dynamodb")>();
	return { ...actual, DynamoDBClient: vi.fn() };
});

process.env.MAIN_TABLE_NAME = "main-table";
process.env.ESPN_NEWS_URL = "https://espn.test/news";

const { handler: fetchNewsCron } = await import("lambdas/fetchNewsCron/src/fetchNewsCron");
const { handler: getNews } = await import("lambdas/getNews/src/getNews");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const EMPTY_RSS = `<?xml version="1.0"?><rss><channel></channel></rss>`;

/**
 * Serves the ESPN payload and empty feeds for every other source, so a test
 * sees exactly the ESPN articles it hands in.
 */
const stubFeeds = (espnArticles: any[]) => {
	fetchMock.mockImplementation(async (url: string) => {
		if (url === process.env.ESPN_NEWS_URL) {
			return { ok: true, json: async () => ({ articles: espnArticles }) };
		}
		if (url.includes("bsky.app")) {
			return { ok: true, json: async () => ({ feed: [] }) };
		}
		return { ok: true, text: async () => EMPTY_RSS };
	});
};

const recent = (minutesAgo: number) =>
	new Date(Date.now() - minutesAgo * 60_000).toISOString();

const espnArticle = (overrides: Record<string, any> = {}) => ({
	dataSourceIdentifier: "abc123",
	headline: "Suns' Mark Williams to miss time after shoulder surgery",
	published: recent(60),
	description: "Williams had surgery.",
	links: { web: { href: "https://www.espn.com/nba/story/_/id/1/williams" } },
	...overrides,
});

const writtenItems = () =>
	send.mock.calls.flatMap(
		([command]) => command.input.RequestItems["main-table"].map((r: any) => r.PutRequest.Item),
	);

beforeEach(() => {
	send.mockReset();
	send.mockResolvedValue({});
	fetchMock.mockReset();
});

describe("fetchNewsCron", () => {
	it("keys the row on the URL, not the publish date or source id", async () => {
		const original = espnArticle();
		stubFeeds([original]);
		await fetchNewsCron({}, {} as any, {} as any);

		// ESPN re-publishes an edited story with a new date and identifier.
		const edited = espnArticle({
			dataSourceIdentifier: "def456",
			headline: "Suns' Mark Williams to miss months after shoulder surgery",
			published: recent(5),
		});
		stubFeeds([edited]);
		await fetchNewsCron({}, {} as any, {} as any);

		const [first, second] = writtenItems();
		expect(first.PK).toBe("NEWS#ESPN");
		expect(first.SK).toBe("URL#https://www.espn.com/nba/story/_/id/1/williams");
		expect(second.PK).toBe(first.PK);
		expect(second.SK).toBe(first.SK);
		expect(second.headline).toBe(edited.headline);
		expect(second.id).toBe("def456");
	});

	it("writes the publish date to the PK2 GSI for newest-first reads", async () => {
		const article = espnArticle();
		stubFeeds([article]);
		await fetchNewsCron({}, {} as any, {} as any);

		const [item] = writtenItems();
		expect(item.PK2).toBe(item.PK);
		expect(item.SK2).toBe(`PUBLISHED_AT#${article.published}`);
		expect(item.publishedAt).toBe(article.published);
	});

	it("normalizes query strings, trailing slashes and case into one key", async () => {
		stubFeeds([
			espnArticle({
				dataSourceIdentifier: "a",
				links: { web: { href: "https://www.espn.com/nba/story/_/id/1/Williams/?src=rss" } },
			}),
			espnArticle({
				dataSourceIdentifier: "b",
				links: { web: { href: "https://www.espn.com/nba/story/_/id/1/williams" } },
			}),
		]);
		await fetchNewsCron({}, {} as any, {} as any);

		const items = writtenItems();
		expect(items).toHaveLength(1);
		expect(items[0].SK).toBe("URL#https://www.espn.com/nba/story/_/id/1/williams");
		expect(items[0].id).toBe("a");
	});

	it("drops an ESPN article that has no web link", async () => {
		stubFeeds([espnArticle({ links: {} }), espnArticle({ dataSourceIdentifier: "kept" })]);
		await fetchNewsCron({}, {} as any, {} as any);

		const items = writtenItems();
		expect(items).toHaveLength(1);
		expect(items[0].id).toBe("kept");
	});
});

describe("getNews", () => {
	it("queries the PK2 index newest-first, per source", async () => {
		send.mockResolvedValue({ Items: [] });

		const result = await getNews({}, {} as any, {} as any);

		expect(result.statusCode).toBe(200);
		const inputs = send.mock.calls.map(([command]) => command.input);
		expect(inputs.map((i) => i.ExpressionAttributeValues[":pk"])).toEqual([
			"NEWS#ESPN",
			"NEWS#Bluesky",
			"NEWS#CBS",
			"NEWS#RealGM",
		]);
		for (const input of inputs) {
			expect(input.TableName).toBe("main-table");
			expect(input.IndexName).toBe("PK2");
			expect(input.KeyConditionExpression).toBe("PK2 = :pk");
			expect(input.ScanIndexForward).toBe(false);
			expect(input.Limit).toBe(25);
		}
	});

	it("strips key attributes and sorts across sources newest-first", async () => {
		const row = (source: string, publishedAt: string, id: string) => ({
			PK: `NEWS#${source}`,
			SK: `URL#https://${source.toLowerCase()}.test/${id}`,
			PK2: `NEWS#${source}`,
			SK2: `PUBLISHED_AT#${publishedAt}`,
			ttl: 1,
			id,
			source,
			headline: id,
			url: `https://${source.toLowerCase()}.test/${id}`,
			publishedAt,
		});
		send
			.mockResolvedValueOnce({ Items: [row("ESPN", "2026-09-12T10:00:00Z", "e1")] })
			.mockResolvedValueOnce({ Items: [row("Bluesky", "2026-09-12T12:00:00Z", "b1")] })
			.mockResolvedValueOnce({ Items: [] })
			.mockResolvedValueOnce({ Items: [row("RealGM", "2026-09-12T11:00:00Z", "r1")] });

		const result = await getNews({}, {} as any, {} as any);
		const articles = JSON.parse(result.body);

		expect(articles.map((a: any) => a.id)).toEqual(["b1", "r1", "e1"]);
		for (const article of articles) {
			expect(article).not.toHaveProperty("PK");
			expect(article).not.toHaveProperty("SK");
			expect(article).not.toHaveProperty("PK2");
			expect(article).not.toHaveProperty("SK2");
			expect(article).not.toHaveProperty("ttl");
		}
	});
});
