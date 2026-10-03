import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { FEEDBACK_SES_REGION, FEEDBACK_SES_IDENTITY } from "../../constants";

export type MainLambdaPolicyProps = {
	prefix: string;
	account: string;
	region: string;
	// The assets CDN, which deleteUserData invalidates. No grant without it.
	assetsDistributionId?: string;
};

/** The statements on the shared main-lambda-role every API Lambda runs as. */
export const mainLambdaPolicyStatements = ({
	prefix,
	account,
	region,
	assetsDistributionId,
}: MainLambdaPolicyProps): PolicyStatement[] => {
	// Queries against a GSI (getNews reads the PK2 index) are authorised
	// on the index ARN, not the table's, so both are listed.
	const dynamoTableResources = [`main`, `users`].flatMap((tableName) => {
		const tableArn = `arn:aws:dynamodb:${region}:${account}:table/${prefix}-${tableName}`;
		return [tableArn, `${tableArn}/index/*`];
	});

	// ListBucket is authorised on the bucket ARN, the object actions on
	// `<bucket>/*`; deleteUserData lists each team's cards before deleting.
	const s3BucketResources = [`main`, `assets`, `static-data`].flatMap((bucketName) => [
		`arn:aws:s3:::${prefix}-${bucketName}`,
		`arn:aws:s3:::${prefix}-${bucketName}/*`,
	]);

	const statements = [
		new PolicyStatement({
			effect: Effect.ALLOW,
			actions: [
				"dynamodb:GetItem",
				"dynamodb:Query",
				"dynamodb:Scan",
				"dynamodb:PutItem",
				"dynamodb:UpdateItem",
				"dynamodb:DeleteItem",
				"dynamodb:BatchWriteItem",
				"dynamodb:BatchGetItem",
			],
			resources: dynamoTableResources,
		}),
		new PolicyStatement({
			effect: Effect.ALLOW,
			actions: [
				"s3:GetObject",
				"s3:PutObject",
				"s3:ListBucket",
				"s3:DeleteObject",
				"s3:AbortMultipartUpload",
				"s3:ListMultipartUploadParts",
			],
			resources: s3BucketResources,
		}),
		// getPublicTeamPage reads the deployed SPA shell. Scoped to that one
		// object: the web bucket is otherwise CloudFront's alone.
		new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ["s3:GetObject"],
			resources: [`arn:aws:s3:::${prefix}-web/index.html`],
		}),
		// The verified sending identity lives in us-east-1 (the only region
		// with SES production access); the stack itself is us-west-2, so this
		// ARN can't be built from the stack's region.
		new PolicyStatement({
			effect: Effect.ALLOW,
			actions: ["ses:SendEmail"],
			resources: [
				`arn:aws:ses:${FEEDBACK_SES_REGION}:${account}:identity/${FEEDBACK_SES_IDENTITY}`,
			],
		}),
	];

	if (assetsDistributionId) {
		statements.push(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ["cloudfront:CreateInvalidation"],
				resources: [`arn:aws:cloudfront::${account}:distribution/${assetsDistributionId}`],
			}),
		);
	}

	return statements;
};
