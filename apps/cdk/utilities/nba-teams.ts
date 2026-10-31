// A player's current team as getPlayers returns it: the ESPN roster code that
// live/headshots.json stores, and ESPN's own name for that team.

export interface PlayerTeam {
	full_name: string;
	abbreviation: string;
}

export const NO_TEAM: PlayerTeam = { full_name: "", abbreviation: "" };

// Spelled as ESPN's standings spell them ("LA Clippers", "GS", "UTAH"), which
// the standings page shows too; test/utilities/nba-teams.test.ts checks this
// against the standings fixture.
export const ESPN_TEAM_NAMES: Record<string, string> = {
	ATL: "Atlanta Hawks",
	BKN: "Brooklyn Nets",
	BOS: "Boston Celtics",
	CHA: "Charlotte Hornets",
	CHI: "Chicago Bulls",
	CLE: "Cleveland Cavaliers",
	DAL: "Dallas Mavericks",
	DEN: "Denver Nuggets",
	DET: "Detroit Pistons",
	GS: "Golden State Warriors",
	HOU: "Houston Rockets",
	IND: "Indiana Pacers",
	LAC: "LA Clippers",
	LAL: "Los Angeles Lakers",
	MEM: "Memphis Grizzlies",
	MIA: "Miami Heat",
	MIL: "Milwaukee Bucks",
	MIN: "Minnesota Timberwolves",
	NO: "New Orleans Pelicans",
	NY: "New York Knicks",
	OKC: "Oklahoma City Thunder",
	ORL: "Orlando Magic",
	PHI: "Philadelphia 76ers",
	PHX: "Phoenix Suns",
	POR: "Portland Trail Blazers",
	SA: "San Antonio Spurs",
	SAC: "Sacramento Kings",
	TOR: "Toronto Raptors",
	UTAH: "Utah Jazz",
	WSH: "Washington Wizards",
};

export const teamFor = (abbreviation: string): PlayerTeam => ({
	full_name: ESPN_TEAM_NAMES[abbreviation] ?? abbreviation,
	abbreviation,
});
