import { Handler } from "aws-lambda";

const { ESPN_TEAMS_URL = "" } = process.env;

interface ESPNTeamLogo {
	alt: string;
	height: number;
	href: string;
	lastUpdated: string;
	rel: string[];
	width: number;
}

interface ESPNTeam {
	abbreviation: string;
	alternateColor: string;
	color: string;
	displayName: string;
	id: string;
	isActive: boolean;
	location: string;
	logos: ESPNTeamLogo[];
	name: string;
	shortDisplayName: string;
	slug: string;
	uid: string;
}

interface ESPNResponse {
	team: ESPNTeam;
}

type Response = {
	abbreviation: string;
	displayName: string;
	logos: ESPNTeamLogo[];
}[];

export const handler: Handler = async (event, context): Promise<any> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	try {
		const finalResponse: Response = [];

		// Fetch logos for all 30 NBA teams
		for (let i = 1; i < 31; i++) {
			const url = `${ESPN_TEAMS_URL}${i}`;
			const response = await fetch(url);
			const { team } = (await response.json()) as ESPNResponse;
			const { abbreviation, displayName, logos } = team;

			finalResponse.push({
				abbreviation,
				displayName,
				logos,
			});
		}

		// Sort logos alphabetically by team abbreviation
		const sortedLogos = finalResponse.sort((a, b) => {
			return a.abbreviation.localeCompare(b.abbreviation);
		});

		return {
			statusCode: 200,
			body: JSON.stringify(sortedLogos),
		};
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Failed to fetch team logos" }),
		};
	}
};
