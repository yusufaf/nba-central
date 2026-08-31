import { EventBridgeEvent, Handler } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const { BBREF_BASE_URL = "", staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

// BBRef allows ~20 req/min; pace the 26 index pages well under that.
const REQUEST_DELAY_MS = 2800;
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface NormalizedPlayer {
	id: string;
	first_name: string;
	last_name: string;
	position: string;
	team: { full_name: string; abbreviation: string };
	height_feet: number | null;
	height_inches: number | null;
	weight_pounds: number | null;
	active: boolean;
}

// "6-9" -> { feet: 6, inches: 9 }
const parseHeight = (h: string): [number | null, number | null] => {
	const [f, i] = (h || "").split("-");
	const feet = parseInt(f, 10);
	const inches = parseInt(i, 10);
	return [
		Number.isFinite(feet) ? feet : null,
		Number.isFinite(inches) ? inches : null,
	];
};

const parsePage = (html: string, currentYear: number): NormalizedPlayer[] => {
	const $ = cheerio.load(html);
	const players: NormalizedPlayer[] = [];

	$("table#players tbody tr").each((_, tr) => {
		const $tr = $(tr);
		const $th = $tr.find('th[data-stat="player"]');
		const id = $th.attr("data-append-csv");
		if (!id) return; // skip class="thead" separator rows

		const fullName = ($th.find("a").text() || $th.text()).trim();
		const spaceIdx = fullName.indexOf(" ");
		const first_name = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx);
		const last_name = spaceIdx === -1 ? "" : fullName.slice(spaceIdx + 1);

		const td = (stat: string) =>
			$tr.find(`td[data-stat="${stat}"]`).text().trim();

		const [height_feet, height_inches] = parseHeight(td("height"));
		const weight = parseInt(td("weight"), 10);
		const yearMax = parseInt(td("year_max"), 10);

		players.push({
			id,
			first_name,
			last_name,
			position: td("pos"),
			team: { full_name: "", abbreviation: "" },
			height_feet,
			height_inches,
			weight_pounds: Number.isFinite(weight) ? weight : null,
			active: Number.isFinite(yearMax) ? yearMax >= currentYear : false,
		});
	});

	return players;
};

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const currentYear = new Date().getFullYear();
		const byId = new Map<string, NormalizedPlayer>();

		for (const letter of LETTERS) {
			try {
				const res = await fetch(
					`${BBREF_BASE_URL}/players/${letter}/`,
					{
						headers: {
							"User-Agent":
								"Mozilla/5.0 (compatible; TeamBuilder/1.0)",
						},
					},
				);
				if (!res.ok) {
					console.error(`/players/${letter}/ -> ${res.status}`);
				} else {
					const html = await res.text();
					for (const p of parsePage(html, currentYear)) {
						byId.set(p.id, p);
					}
				}
			} catch (e) {
				console.error(`Failed letter ${letter}`, e);
			}
			await sleep(REQUEST_DELAY_MS);
		}

		const players = Array.from(byId.values()).sort((a, b) =>
			`${a.first_name} ${a.last_name}`.localeCompare(
				`${b.first_name} ${b.last_name}`,
			),
		);

		await s3Client.send(
			new PutObjectCommand({
				Bucket: staticDataBucket,
				Key: "players.json",
				Body: JSON.stringify({ data: players }),
				ContentType: "application/json",
			}),
		);

		console.log(
			`Saved ${players.length} players to ${staticDataBucket}/players.json`,
		);

		return {
			statusCode: 200,
			body: JSON.stringify({ message: "Players saved", count: players.length }),
		};
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch players" }),
		};
	}
};
