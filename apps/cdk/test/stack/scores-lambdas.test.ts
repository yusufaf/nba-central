import { describe, it, expect, vi, beforeEach } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { ESPN_API_BASE_URL } from "../../constants";
import getScoreboardDay from "../../service/lambdas/getScoreboardDay";
import getScoreboardMonth from "../../service/lambdas/getScoreboardMonth";
import getGameSummary from "../../service/lambdas/getGameSummary";

// A real TeamBuilderLambda needs the role registry and an esbuild bundle;
// `pnpm synth` covers those. This checks the config each one is given.
const { calls } = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("../../service/constructs/TeamBuilderLambda", () => ({
	TeamBuilderLambda: class {
		lambdaFunction = {};
		constructor(...args: unknown[]) {
			calls.push(args);
		}
	},
}));

beforeEach(() => {
	calls.length = 0;
});

describe("scores Lambdas", () => {
	it.each([
		["getScoreboardDay", getScoreboardDay],
		["getScoreboardMonth", getScoreboardMonth],
		["getGameSummary", getGameSummary],
	])("%s calls ESPN with a 10 s timeout in every deployment", (name, build) => {
		build({
			construct: new Stack(new App(), "s"),
			props: { appName: "team-builder", deploymentType: "development" },
		});

		expect(calls).toHaveLength(1);
		const config = calls[0][2] as {
			functionName: string;
			environment: Record<string, string>;
			timeout: { toSeconds: () => number };
			memorySize: number;
			deployToTypes?: unknown;
		};
		expect(config.functionName).toBe(name);
		expect(config.environment).toEqual({ ESPN_API_BASE_URL });
		expect(config.timeout.toSeconds()).toBe(10);
		expect(config.memorySize).toBe(512);
		expect(config.deployToTypes).toBeUndefined();
	});
});
