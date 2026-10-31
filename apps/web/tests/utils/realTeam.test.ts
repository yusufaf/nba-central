import { describe, it, expect } from "vitest";
import type { TeamSeason, TeamSeasonFile, TeamSeasonsIndex } from "@/models/teamSeasons";
import {
    arenaName,
    findCoach,
    findGM,
    findJersey,
    findLogo,
    findSeasonChoice,
    franchiseChoices,
    parseRealParam,
    parseStint,
    realParam,
    realTeamDetails,
    rosterSlots,
    seasonChoices,
} from "@/utils/realTeam";

const team = (fields: Partial<TeamSeason> = {}): TeamSeason => ({
    code: "CHI",
    franchise: "CHI",
    name: "Chicago Bulls",
    coachId: "jacksph01c",
    arena: "United Center",
    roster: [],
    starters: 0,
    alternates: [],
    ...fields,
});

const index: TeamSeasonsIndex = {
    version: 1,
    generatedAt: "",
    seasons: [
        {
            league: "NBA",
            year: 2008,
            label: "2007-08",
            path: "team-seasons/NBA-2008.json",
            teams: [
                { code: "SEA", franchise: "OKC", name: "Seattle SuperSonics" },
                { code: "CHI", franchise: "CHI", name: "Chicago Bulls" },
            ],
        },
        {
            league: "ABA",
            year: 1975,
            label: "1974-75",
            path: "team-seasons/ABA-1975.json",
            teams: [{ code: "KEN", franchise: "KEN", name: "Kentucky Colonels" }],
        },
    ],
};

const current: TeamSeasonFile = {
    version: 1,
    league: "NBA",
    year: 2027,
    label: "2026-27",
    generatedAt: "",
    teams: [team({ code: "OKC", franchise: "OKC", name: "Oklahoma City Thunder" })],
};

describe("parseRealParam / realParam", () => {
    it("reads a team code and season end year", () => {
        expect(parseRealParam("CHI-1996")).toEqual({ code: "CHI", year: 1996 });
        expect(realParam({ code: "SEA", year: 2008 })).toBe("SEA-2008");
    });

    it.each([["chi-1996"], ["CHI1996"], ["CHI-96"], [""], [undefined], [["CHI-1996"]]])("refuses %j", (value) => {
        expect(parseRealParam(value)).toBeNull();
    });
});

describe("seasonChoices", () => {
    it("puts the current season first, as a choice with no path", () => {
        const choices = seasonChoices(index, current);
        expect(choices.map((c) => [c.year, c.path])).toEqual([
            [2027, null],
            [2008, "team-seasons/NBA-2008.json"],
            [1975, "team-seasons/ABA-1975.json"],
        ]);
    });

    it("prefers the finished season once the index has it", () => {
        const finished = { ...index, seasons: [{ ...index.seasons[0], year: 2027, label: "2026-27" }] };
        expect(seasonChoices(finished, current).map((c) => c.path)).toEqual(["team-seasons/NBA-2008.json"]);
    });

    it("works without a current season", () => {
        expect(seasonChoices(index, null)).toHaveLength(2);
    });
});

describe("franchiseChoices", () => {
    it("groups seasons by lineage under the newest name, alphabetically", () => {
        const choices = franchiseChoices(seasonChoices(index, current));
        expect(choices.map((c) => c.name)).toEqual(["Chicago Bulls", "Kentucky Colonels", "Oklahoma City Thunder"]);
        const okc = choices.find((c) => c.franchise === "OKC")!;
        expect(okc.seasons.map((s) => `${s.code}-${s.year}`)).toEqual(["OKC-2027", "SEA-2008"]);
    });
});

describe("findSeasonChoice", () => {
    it("finds the season holding that team code", () => {
        const choices = seasonChoices(index, current);
        expect(findSeasonChoice(choices, { code: "SEA", year: 2008 })?.path).toBe("team-seasons/NBA-2008.json");
        expect(findSeasonChoice(choices, { code: "OKC", year: 2027 })?.path).toBeNull();
        expect(findSeasonChoice(choices, { code: "SEA", year: 2027 })).toBeNull();
    });
});

describe("rosterSlots", () => {
    it("fills the starter slots, then the bench from slot 6", () => {
        const slots = rosterSlots(
            team({ roster: ["a", "b", "c", "d", "e", "f", "g"], starters: 5 }),
            new Set(["a", "b", "c", "d", "e", "f", "g"]),
        );
        expect([...slots]).toEqual([
            [1, "a"], [2, "b"], [3, "c"], [4, "d"], [5, "e"], [6, "f"], [7, "g"],
        ]);
    });

    it("gives an unknown player's spot to the next alternate", () => {
        const slots = rosterSlots(
            team({ roster: ["a", "gone", "c"], starters: 3, alternates: ["alsoGone", "x", "y"] }),
            new Set(["a", "c", "x", "y"]),
        );
        expect([...slots]).toEqual([[1, "a"], [2, "x"], [3, "c"]]);
    });

    it("never places a player twice or past slot 15", () => {
        const roster = Array.from({ length: 16 }, (_, i) => `p${i}`);
        const slots = rosterSlots(
            team({ roster: [...roster, "p0"], starters: 5, alternates: ["p1"] }),
            new Set(roster),
        );
        expect(slots.size).toBe(15);
        expect(new Set(slots.values()).size).toBe(15);
        expect(Math.max(...slots.keys())).toBe(15);
    });

    it("closes the gap when the alternates run out", () => {
        const slots = rosterSlots(team({ roster: ["a", "gone", "c"], starters: 2 }), new Set(["a", "c"]));
        expect([...slots]).toEqual([[1, "a"], [2, "c"]]);
    });
});

describe("identity lookups", () => {
    it("keeps coaches.json's row, so the Hall of Fame star survives", () => {
        expect(findCoach(team())?.name).toBe("Phil Jackson*");
    });

    it("falls back to the season file's coach name", () => {
        expect(findCoach(team({ coachId: "nobodyxx01c", coachName: "Joe Mullaney" }))).toEqual({
            name: "Joe Mullaney",
            isCustom: false,
        });
        expect(findCoach(team({ coachId: null }))).toBeNull();
    });

    it("finds the logo era and the home/road jersey", () => {
        expect(findLogo("CHI", 1996)).toContain("/logos/historical/CHI-");
        expect(findLogo("ZZZ", 1996)).toBe("");
        expect(findJersey("CHI", 1996)).toMatch(/31d308_a718ea8f/);
        expect(findJersey("CHI", 1851)).toBe("");
        // A row whose `seasons` list is empty still counts by its years.
        expect(findJersey("OKC", 2012)).not.toBe("");
        // PHI's newest row ends at 2024 but is the "2023-Present" design.
        expect(findJersey("PHI", 2027)).toBe(findJersey("PHI", 2024));
        expect(findJersey("PHI", 2027)).not.toBe("");
    });

    it("strips BBRef's building numbers from arena names", () => {
        expect(arenaName("Madison Square Garden (IV)")).toBe("Madison Square Garden");
        expect(arenaName("United Center")).toBe("United Center");
    });
});

describe("parseStint / findGM", () => {
    it("reads every execs.json stint format", () => {
        expect(parseStint("CHI (1985-2003)")).toEqual({ franchise: "CHI", start: 1985, end: 2003 });
        expect(parseStint("BOS (2003-21)")).toEqual({ franchise: "BOS", start: 2003, end: 2021 });
        expect(parseStint("SEA (1957)")).toEqual({ franchise: "OKC", start: 1957, end: 1957 });
        expect(parseStint("SEA/OKC (2007-27)")).toEqual({ franchise: "OKC", start: 2007, end: 2027 });
        expect(parseStint("garbage")).toBeNull();
    });

    it("picks the executive in charge that season", () => {
        expect(findGM("CHI", 1996)?.name).toBe("Jerry Krause");
        expect(findGM("OKC", 2012)?.name).toBe("Sam Presti");
    });

    it("gives a shared year to the one hired earlier", () => {
        // Lindsey: UTA (2012-21); Ainge: UTA (2021-27), hired at the end of 2020-21.
        expect(findGM("UTA", 2021)?.name).toBe("Dennis Lindsey");
        expect(findGM("UTA", 2022)?.name).toBe("Danny Ainge");
    });
});

describe("realTeamDetails", () => {
    it("fills everything but the roster", () => {
        const details = realTeamDetails(team(), { year: 1996, label: "1995-96" });
        expect(details).toMatchObject({
            teamName: "1995-96 Chicago Bulls",
            teamCity: "Chicago",
            teamCountry: "USA",
            teamGM: { name: "Jerry Krause" },
            teamCoach: { name: "Phil Jackson*" },
            teamArena: { name: "United Center", location: "Chicago, Illinois" },
        });
        expect(details.teamLogo).not.toBe("");
        expect(details.teamJersey).not.toBe("");
    });

    it("leaves out what the season doesn't have", () => {
        const details = realTeamDetails(
            team({ code: "BLB", franchise: "BLB", name: "Baltimore Bullets", coachId: null, arena: null }),
            { year: 1955, label: "1954-55" },
        );
        expect(details).toMatchObject({ teamCoach: null, teamArena: null });
    });
});
