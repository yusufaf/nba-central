import { describe, it, expect } from "vitest";
import { Stack } from "aws-cdk-lib";
import { ExtendedStackProps, LambdaProps } from "../../models/stack";
import deleteCustomArena from "../../service/lambdas/deleteCustomArena";
import uploadArenaImage from "../../service/lambdas/uploadArenaImage";
import deleteArenaImage from "../../service/lambdas/deleteArenaImage";

// The arena Lambdas that touch the assets bucket need the CDN's domain or id
// in their environment. Without them an upload would store "https:///…"
// URLs and a delete would leave the images cached, so building one without
// them has to fail at synth rather than in production.
const cases: [string, (props: LambdaProps) => unknown, keyof ExtendedStackProps][] = [
	["deleteCustomArena", deleteCustomArena, "assetsDistributionId"],
	["uploadArenaImage", uploadArenaImage, "assetsCdnDomain"],
	["deleteArenaImage", deleteArenaImage, "assetsDistributionId"],
];

describe("custom arena Lambdas", () => {
	it.each(cases)("%s refuses to build without %s", (_name, factory, prop) => {
		const props: ExtendedStackProps = {
			appName: "team-builder",
			deploymentType: "development",
			assetsCdnDomain: "cdn.example",
			assetsDistributionId: "EDIST123",
		};
		delete props[prop];
		expect(() => factory({ construct: new Stack(), props })).toThrow(prop);
	});
});
