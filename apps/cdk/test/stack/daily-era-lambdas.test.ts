import { describe, it, expect } from "vitest";
import { Stack } from "aws-cdk-lib";
import getDailyEra from "../../service/lambdas/getDailyEra";

// Without the CDN domain every puzzle's image URL would be "https:///…", so
// building getDailyEra without it has to fail at synth rather than in production.
describe("Daily Era Lambdas", () => {
	it("getDailyEra refuses to build without assetsCdnDomain", () => {
		expect(() =>
			getDailyEra({
				construct: new Stack(),
				props: { appName: "team-builder", deploymentType: "development" },
			}),
		).toThrow("assetsCdnDomain");
	});
});
