import { EventBridgeEvent, Handler } from "aws-lambda";
import {
	S3Client,
	GetObjectCommand,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { nbaPositions } from "utilities/positions";
import {
	indexByName,
	normalizeName,
	resolveMatch,
	toTotalInches,
	type PoolPlayer,
} from "utilities/player-names";

const { NBA2K_API_BASE_URL = "", staticDataBucket = "" } = process.env;

const s3Client = new S3Client();

// The public endpoint allows 60 req/min per IP and caps `limit` at 100. ~19
// pages for the whole roster, so this whole run is well under a minute of
// requests even with the pacing.
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 1100;

// Ratings are pulled in this order and the first hit wins: an active player's
// current-game rating beats their All-Time entry, which beats the best of
// their Classic-team (season-specific) versions.
const TEAM_TYPES = ["curr", "allt", "class"] as const;
type TeamType = (typeof TEAM_TYPES)[number];

const RATING_SOURCE: Record<TeamType, string> = {
	curr: "current",
	allt: "all-time",
	class: "classic-peak",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TwoKRatingHistoryEntry {
	gameVersion: string;
	overall: number;
}

interface TwoKPlayer {
	name: string;
	slug: string;
	team: string;
	teamType: TeamType;
	overall: number;
	positions?: string[];
	height?: string;
	gameVersion?: string;
	ratingHistory?: TwoKRatingHistoryEntry[];
}

interface PlayerRating {
	rating: number;
	ratingSource: string;
	slug: string;
	positions?: string[];
	history?: TwoKRatingHistoryEntry[];
}

// 2K reports height as `6'11"`; players.json splits it into feet and inches.
const parse2KHeight = (height: string): [number | null, number | null] => {
	const match = /(\d+)\s*'\s*(\d+)/.exec(height || "");
	if (!match) return [null, null];
	return [parseInt(match[1], 10), parseInt(match[2], 10)];
};

const fetchTeamType = async (teamType: TeamType): Promise<TwoKPlayer[]> => {
	const players: TwoKPlayer[] = [];
	let cursor: string | null = null;

	do {
		const url = new URL(`${NBA2K_API_BASE_URL}/public/players`);
		url.searchParams.set("teamType", teamType);
		url.searchParams.set("limit", String(PAGE_SIZE));
		if (cursor) url.searchParams.set("cursor", cursor);

		const response = await fetch(url, {
			headers: { "User-Agent": "TeamBuilder/1.0" },
		});
		if (!response.ok) {
			throw new Error(
				`nba2kapi ${teamType} returned ${response.status} ${response.statusText}`,
			);
		}

		const body: any = await response.json();
		players.push(...(body?.data || []));
		const pagination = body?.meta?.pagination;
		cursor = pagination?.hasMore ? pagination.nextCursor : null;

		await sleep(REQUEST_DELAY_MS);
	} while (cursor);

	console.log(`Fetched ${players.length} ${teamType} players`);
	return players;
};

const loadBBRefPlayers = async (): Promise<PoolPlayer[]> => {
	const { Body } = await s3Client.send(
		new GetObjectCommand({
			Bucket: staticDataBucket,
			Key: "players.json",
		}),
	);
	const raw = await Body!.transformToString();
	const { data } = JSON.parse(raw) as { data: PoolPlayer[] };
	return data || [];
};

export const handler: Handler = async (
	event: EventBridgeEvent<any, any>,
	context,
): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const bbrefPlayers = await loadBBRefPlayers();

	const byName = indexByName(bbrefPlayers);

	const ratings: Record<string, PlayerRating> = {};
	const unmatchedCurrent: string[] = [];
	let gameVersion = "";
	let sourcePlayerCount = 0;

	for (const teamType of TEAM_TYPES) {
		const twoKPlayers = await fetchTeamType(teamType);
		sourcePlayerCount += twoKPlayers.length;

		for (const twoKPlayer of twoKPlayers) {
			if (!gameVersion && twoKPlayer.gameVersion) {
				gameVersion = twoKPlayer.gameVersion;
			}

			const candidates =
				byName.get(normalizeName(twoKPlayer.name)) || [];
			const match = resolveMatch(candidates, {
				name: twoKPlayer.name,
				heightInches: toTotalInches(
					...parse2KHeight(twoKPlayer.height || ""),
				),
				currentOnly: twoKPlayer.teamType === "curr",
			});

			if (!match) {
				// Every active NBA player is in players.json, so an
				// unmatched `curr` entry is a bug worth surfacing rather
				// than a gap in coverage.
				if (teamType === "curr") {
					unmatchedCurrent.push(twoKPlayer.name);
				}
				continue;
			}

			const existing = ratings[match.id];

			// A higher-precedence source already claimed this player.
			if (existing && existing.ratingSource !== RATING_SOURCE.class) {
				continue;
			}

			// Within Classic, a player has one entry per season version -
			// keep their peak.
			if (existing && existing.rating >= twoKPlayer.overall) continue;

			const history = twoKPlayer.ratingHistory?.length
				? twoKPlayer.ratingHistory.map(
						({ gameVersion: version, overall }) => ({
							gameVersion: version,
							overall,
						}),
					)
				: undefined;

			ratings[match.id] = {
				rating: twoKPlayer.overall,
				ratingSource: RATING_SOURCE[teamType],
				slug: twoKPlayer.slug,
				positions: Array.isArray(twoKPlayer.positions) ? nbaPositions(twoKPlayer.positions) : undefined,
				history,
			};
		}
	}

	const matchedCount = Object.keys(ratings).length;

	await s3Client.send(
		new PutObjectCommand({
			Bucket: staticDataBucket,
			Key: "player-ratings.json",
			Body: JSON.stringify({
				gameVersion,
				generated: new Date().toISOString(),
				sourcePlayerCount,
				matchedCount,
				unmatchedCurrent,
				data: ratings,
			}),
			ContentType: "application/json",
		}),
	);

	console.log(
		`Saved ${matchedCount} ratings (${gameVersion}) to ${staticDataBucket}/player-ratings.json; ${unmatchedCurrent.length} unmatched current players`,
	);
	if (unmatchedCurrent.length) {
		console.warn(
			`Unmatched current players: ${unmatchedCurrent.join(", ")}`,
		);
	}

	return {
		statusCode: 200,
		body: JSON.stringify({
			message: "Player ratings saved",
			gameVersion,
			matchedCount,
			unmatchedCurrent: unmatchedCurrent.length,
		}),
	};
};
