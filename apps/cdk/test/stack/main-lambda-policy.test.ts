import { describe, it, expect } from "vitest";
import { mainLambdaPolicyStatements } from "../../service/team-builder-stack/main-lambda-policy";

const statements = (assetsDistributionId?: string) =>
	mainLambdaPolicyStatements({
		prefix: "team-builder-production",
		account: "123456789012",
		region: "us-west-2",
		assetsDistributionId,
	}).map((statement) => statement.toStatementJson());

const withAction = (action: string, assetsDistributionId?: string) =>
	statements(assetsDistributionId).filter((statement) =>
		[statement.Action].flat().includes(action),
	);

describe("main-lambda-role policy", () => {
	it("grants ListBucket on the stack's own buckets, not on buckets named main/assets", () => {
		const [s3] = withAction("s3:ListBucket");
		expect(s3.Resource).toEqual([
			"arn:aws:s3:::team-builder-production-main",
			"arn:aws:s3:::team-builder-production-main/*",
			"arn:aws:s3:::team-builder-production-assets",
			"arn:aws:s3:::team-builder-production-assets/*",
			"arn:aws:s3:::team-builder-production-static-data",
			"arn:aws:s3:::team-builder-production-static-data/*",
		]);
	});

	it("scopes CreateInvalidation to the assets distribution alone", () => {
		const grants = withAction("cloudfront:CreateInvalidation", "EASSETS123");
		expect(grants).toHaveLength(1);
		expect(grants[0].Resource).toBe(
			"arn:aws:cloudfront::123456789012:distribution/EASSETS123",
		);
		expect(grants[0].Action).toBe("cloudfront:CreateInvalidation");
	});

	it("grants no CloudFront access without a distribution id", () => {
		expect(
			statements().some((statement) =>
				[statement.Action].flat().some((action: string) => action.startsWith("cloudfront:")),
			),
		).toBe(false);
	});

	it("keeps BatchWriteItem on both tables for the batched delete", () => {
		const [dynamo] = withAction("dynamodb:BatchWriteItem");
		expect(dynamo.Resource).toContain(
			"arn:aws:dynamodb:us-west-2:123456789012:table/team-builder-production-main",
		);
		expect(dynamo.Resource).toContain(
			"arn:aws:dynamodb:us-west-2:123456789012:table/team-builder-production-users",
		);
	});
});
