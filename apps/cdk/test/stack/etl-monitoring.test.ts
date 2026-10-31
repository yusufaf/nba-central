import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Function } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
import setPlayersData from "../../service/lambdas/setPlayersData";
import setPlayerRatingsData from "../../service/lambdas/setPlayerRatingsData";
import setPlayerStatsData from "../../service/lambdas/setPlayerStatsData";
import setSeasonContextData from "../../service/lambdas/setSeasonContextData";
import publishCapFive from "../../service/lambdas/publishCapFive";
import fetchNewsCron from "../../service/lambdas/fetchNewsCron";

// As in scores-lambdas.test.ts, this checks the config each wrapper passes.
// The stand-in function is real enough for fetchNewsCron's and
// setSeasonContextData's own Rules to target it.
const { calls } = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("../../service/constructs/TeamBuilderLambda", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../service/constructs/TeamBuilderLambda")>();
	return {
		...actual,
		TeamBuilderLambda: class {
			lambdaFunction: unknown;
			constructor(scope: Construct, id: string, config: unknown) {
				calls.push([scope, id, config]);
				this.lambdaFunction = Function.fromFunctionArn(
					scope,
					`${id}-fn`,
					"arn:aws:lambda:us-west-2:123456789012:function:f",
				);
			}
		},
	};
});

type MonitorConfig = {
	monitor?: { failuresToAlarm?: number };
	functionProps?: { retryAttempts?: number };
};

const configOf = (build: (props: any) => unknown) => {
	calls.length = 0;
	build({
		construct: new Stack(new App(), "s"),
		props: { appName: "team-builder", deploymentType: "production" },
	});
	expect(calls).toHaveLength(1);
	return calls[0][2] as MonitorConfig;
};

const wrappers = [
	["setPlayersData", setPlayersData],
	["setPlayerRatingsData", setPlayerRatingsData],
	["setPlayerStatsData", setPlayerStatsData],
	["setSeasonContextData", setSeasonContextData],
	["publishCapFive", publishCapFive],
	["fetchNewsCron", fetchNewsCron],
] as const;

beforeEach(() => {
	calls.length = 0;
});

describe("scheduled Lambda monitoring", () => {
	it.each(wrappers)("%s alarms and keeps failed events", (_, build) => {
		expect(configOf(build).monitor).toBeDefined();
	});

	// An isolated timeout or flaky feed recovers on the next 15-minute run.
	it("fetchNewsCron alarms only after three failed runs and doesn't retry", () => {
		const config = configOf(fetchNewsCron);
		expect(config.monitor).toEqual({ failuresToAlarm: 3 });
		expect(config.functionProps?.retryAttempts).toBe(0);
	});

	it.each(wrappers.filter(([name]) => name !== "fetchNewsCron"))(
		"%s alarms on the first failure",
		(_, build) => {
			expect(configOf(build).monitor?.failuresToAlarm).toBeUndefined();
		},
	);
});
