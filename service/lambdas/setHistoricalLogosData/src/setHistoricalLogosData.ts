import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const { staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

// NBA team IDs from SportsLogos.net
const NBA_TEAMS = [
	{ id: 220, name: "Atlanta Hawks", slug: "Atlanta_Hawks" },
	{ id: 213, name: "Boston Celtics", slug: "Boston_Celtics" },
	{ id: 3786, name: "Brooklyn Nets", slug: "Brooklyn_Nets" },
	{ id: 5120, name: "Charlotte Hornets", slug: "Charlotte_Hornets" },
	{ id: 221, name: "Chicago Bulls", slug: "Chicago_Bulls" },
	{ id: 222, name: "Cleveland Cavaliers", slug: "Cleveland_Cavaliers" },
	{ id: 228, name: "Dallas Mavericks", slug: "Dallas_Mavericks" },
	{ id: 229, name: "Denver Nuggets", slug: "Denver_Nuggets" },
	{ id: 223, name: "Detroit Pistons", slug: "Detroit_Pistons" },
	{ id: 235, name: "Golden State Warriors", slug: "Golden_State_Warriors" },
	{ id: 230, name: "Houston Rockets", slug: "Houston_Rockets" },
	{ id: 224, name: "Indiana Pacers", slug: "Indiana_Pacers" },
	{ id: 236, name: "Los Angeles Clippers", slug: "Los_Angeles_Clippers" },
	{ id: 237, name: "Los Angeles Lakers", slug: "Los_Angeles_Lakers" },
	{ id: 231, name: "Memphis Grizzlies", slug: "Memphis_Grizzlies" },
	{ id: 214, name: "Miami Heat", slug: "Miami_Heat" },
	{ id: 225, name: "Milwaukee Bucks", slug: "Milwaukee_Bucks" },
	{ id: 232, name: "Minnesota Timberwolves", slug: "Minnesota_Timberwolves" },
	{ id: 4962, name: "New Orleans Pelicans", slug: "New_Orleans_Pelicans" },
	{ id: 216, name: "New York Knicks", slug: "New_York_Knicks" },
	{ id: 2687, name: "Oklahoma City Thunder", slug: "Oklahoma_City_Thunder" },
	{ id: 217, name: "Orlando Magic", slug: "Orlando_Magic" },
	{ id: 218, name: "Philadelphia 76ers", slug: "Philadelphia_76ers" },
	{ id: 238, name: "Phoenix Suns", slug: "Phoenix_Suns" },
	{ id: 239, name: "Portland Trail Blazers", slug: "Portland_Trail_Blazers" },
	{ id: 240, name: "Sacramento Kings", slug: "Sacramento_Kings" },
	{ id: 233, name: "San Antonio Spurs", slug: "San_Antonio_Spurs" },
	{ id: 227, name: "Toronto Raptors", slug: "Toronto_Raptors" },
	{ id: 234, name: "Utah Jazz", slug: "Utah_Jazz" },
	{ id: 219, name: "Washington Wizards", slug: "Washington_Wizards" },
];

interface Logo {
	url: string;
	years: string;
	type: string;
}

interface TeamLogos {
	name: string;
	id: number;
	logos: {
		primary: Logo[];
		alternate: Logo[];
		wordmark: Logo[];
		jersey: Logo[];
	};
}

interface HistoricalLogosData {
	lastUpdated: string;
	teams: Record<string, TeamLogos>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeTeamLogos(team: (typeof NBA_TEAMS)[0]): Promise<TeamLogos> {
	const url = `https://www.sportslogos.net/logos/list_by_team/${team.id}/${team.slug}/`;
	console.log(`Scraping logos for ${team.name} from ${url}`);

	const response = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		},
	});

	if (!response.ok) {
		console.error(`Failed to fetch ${team.name}: ${response.status}`);
		return {
			name: team.name,
			id: team.id,
			logos: { primary: [], alternate: [], wordmark: [], jersey: [] },
		};
	}

	const html = await response.text();
	const $ = cheerio.load(html);

	const logos: TeamLogos = {
		name: team.name,
		id: team.id,
		logos: {
			primary: [],
			alternate: [],
			wordmark: [],
			jersey: [],
		},
	};

	// Find all logo sections
	$(".logosWall").each((_, wall) => {
		const wallCheerio = $(wall);
		const sectionTitle = wallCheerio.prev("h2").text().toLowerCase().trim();

		// Determine logo category
		let category: keyof TeamLogos["logos"] | null = null;
		if (sectionTitle.includes("primary") && !sectionTitle.includes("dark")) {
			category = "primary";
		} else if (sectionTitle.includes("alternate")) {
			category = "alternate";
		} else if (sectionTitle.includes("wordmark")) {
			category = "wordmark";
		} else if (sectionTitle.includes("jersey")) {
			category = "jersey";
		}

		if (!category) return;

		// Extract logos from this section
		wallCheerio.find("li a").each((_, anchor) => {
			const anchorCheerio = $(anchor);
			const img = anchorCheerio.find("img");
			const imgSrc = img.attr("src");
			const yearsText = anchorCheerio.find(".logoYears, .itemYears").text().trim();

			if (imgSrc) {
				// Convert thumbnail URL to full-size URL
				const fullSizeUrl = imgSrc
					.replace("/thumbs/", "/full/")
					.replace(".gif", ".png");

				logos.logos[category].push({
					url: fullSizeUrl,
					years: yearsText || "Unknown",
					type: category,
				});
			}
		});
	});

	console.log(
		`Found ${team.name}: ${logos.logos.primary.length} primary, ${logos.logos.alternate.length} alternate, ${logos.logos.wordmark.length} wordmark, ${logos.logos.jersey.length} jersey`
	);

	return logos;
}

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const historicalLogosData: HistoricalLogosData = {
			lastUpdated: new Date().toISOString(),
			teams: {},
		};

		// Scrape each team with a delay to be respectful
		for (const team of NBA_TEAMS) {
			try {
				const teamLogos = await scrapeTeamLogos(team);
				historicalLogosData.teams[team.id.toString()] = teamLogos;

				// Add delay between requests to avoid rate limiting
				await delay(1500);
			} catch (err) {
				console.error(`Error scraping ${team.name}:`, err);
				// Continue with other teams even if one fails
			}
		}

		// Save to S3
		const putObjectCommand = new PutObjectCommand({
			Bucket: staticDataBucket,
			Key: "historical-logos.json",
			Body: JSON.stringify(historicalLogosData, null, 2),
			ContentType: "application/json",
		});

		await s3Client.send(putObjectCommand);
		console.log(
			`Successfully saved historical logos data for ${Object.keys(historicalLogosData.teams).length} teams`
		);

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Historical logos data updated successfully",
				teamsProcessed: Object.keys(historicalLogosData.teams).length,
			}),
		};
	} catch (err) {
		console.error("Error in setHistoricalLogosData:", err);
		throw err;
	}
};
