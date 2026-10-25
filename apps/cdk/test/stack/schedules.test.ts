import { describe, it, expect } from "vitest";
import { Duration } from "aws-cdk-lib";
import { toSchedule } from "../../service/constructs/TeamBuilderLambda";
import {
	PLAYERS_DATA_CRON,
	PLAYERS_DATA_TIMEOUT,
} from "../../service/lambdas/setPlayersData";
import { SNAPSHOT_TIMEOUT } from "../../service/lambdas/setPlayerStatsData";
import {
	SEASON_CONTEXT_CRON,
	SEASON_CONTEXT_TIMEOUT,
} from "../../service/lambdas/setSeasonContextData";
import {
	SNAPSHOT_INTERVAL_MINUTES,
	SNAPSHOT_STOP_AFTER_MINUTES,
} from "utilities/player-stats";

describe("toSchedule", () => {
	it("keeps a rate a rate", () => {
		expect(toSchedule({ rate: Duration.days(7) }).expressionString).toBe("rate(7 days)");
	});

	it("builds a cron expression", () => {
		expect(toSchedule({ cron: { minute: "0/20" } }).expressionString).toBe(
			"cron(0/20 * * * ? *)",
		);
	});
});

describe("setSeasonContextData", () => {
	it("runs hourly and finishes inside its hour", () => {
		expect(toSchedule({ cron: SEASON_CONTEXT_CRON }).expressionString).toBe(
			"cron(7 * * * ? *)",
		);
		expect(SEASON_CONTEXT_TIMEOUT.toMinutes()).toBeLessThan(60);
	});
});

// Both scrape Basketball-Reference; together they would break its 20 requests
// a minute.
describe("setPlayersData never runs while the snapshot does", () => {
	const playersMinute = Number(PLAYERS_DATA_CRON.minute);

	it("starts after the snapshot's last request in its slot", () => {
		expect(SNAPSHOT_STOP_AFTER_MINUTES).toBeLessThan(playersMinute);
		expect(SNAPSHOT_TIMEOUT.toMinutes()).toBeLessThan(playersMinute);
	});

	it("finishes before the next snapshot slot", () => {
		expect(playersMinute + PLAYERS_DATA_TIMEOUT.toMinutes()).toBeLessThan(
			SNAPSHOT_INTERVAL_MINUTES,
		);
	});

	it("never lets two snapshot runs overlap", () => {
		expect(SNAPSHOT_TIMEOUT.toMinutes()).toBeLessThan(SNAPSHOT_INTERVAL_MINUTES);
	});

	it("lines epoch-based slots up with the cron's :00/:20/:40", () => {
		expect(60 % SNAPSHOT_INTERVAL_MINUTES).toBe(0);
	});
});
