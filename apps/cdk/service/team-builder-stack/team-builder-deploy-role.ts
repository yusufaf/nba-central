import { Duration, Stack } from "aws-cdk-lib";
import {
	OpenIdConnectProvider,
	OpenIdConnectPrincipal,
	Role,
	PolicyStatement,
	Effect,
} from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { Construct } from "constructs";
import { ExtendedStackProps } from "models/stack";

const GITHUB_OIDC_THUMBPRINT_URL = "https://token.actions.githubusercontent.com";
// GitHub's OIDC token audience for the standard configure-aws-credentials
// flow — not a secret, this is the same fixed value every repo uses.
const GITHUB_OIDC_AUDIENCE = "sts.amazonaws.com";

export interface TeamBuilderDeployRoleProps extends ExtendedStackProps {
	// "owner/repo" — scopes the trust policy so only this repo's `main`
	// branch workflow runs can assume the role, not any GitHub Actions job
	// anywhere that happens to reuse the same OIDC provider.
	githubRepo: string;
	bucket: Bucket;
	distribution: Distribution;
}

// GitHub Actions OIDC provider + a narrowly-scoped IAM role nba-central's
// deploy.yml assumes to sync the production build to S3 and invalidate
// CloudFront — no long-lived AWS keys in CI. Deploy-gated to production
// only by the caller (team-builder.ts), same pattern as TeamBuilderWeb.
export class TeamBuilderDeployRole extends Construct {
	readonly roleArn: string;

	constructor(scope: Construct, id: string, props: TeamBuilderDeployRoleProps) {
		super(scope, id);

		const {
			appName = "team-builder",
			deploymentType = "production",
			githubRepo,
			bucket,
			distribution,
		} = props;

		// AWS's GitHub OIDC root CA thumbprint has been stable since GitHub
		// enabled OIDC; CDK's OpenIdConnectProvider computes it automatically
		// via a custom resource if left unset, which is the recommended path
		// going forward — no thumbprint pinned here.
		//
		// Only one OIDC provider per URL is allowed per AWS account (confirmed
		// via `aws iam list-open-id-connect-providers` — none exists yet, this
		// is the first). If a second AWS-account-hosted project ever adds its
		// own deploy role, reuse this provider via
		// OpenIdConnectProvider.fromOpenIdConnectProviderArn() instead of
		// instantiating a second one — creating a duplicate for the same URL
		// fails at deploy time.
		const provider = new OpenIdConnectProvider(this, `${appName}-github-oidc`, {
			url: GITHUB_OIDC_THUMBPRINT_URL,
			clientIds: [GITHUB_OIDC_AUDIENCE],
		});

		const roleNameAndId = `${appName}-${deploymentType}-deploy-role`;
		const role = new Role(this, roleNameAndId, {
			roleName: roleNameAndId,
			// sub condition restricts this to workflow runs triggered by a
			// push to main in exactly this repo — not PRs, not other repos
			// sharing the same OIDC provider.
			assumedBy: new OpenIdConnectPrincipal(provider, {
				StringEquals: {
					"token.actions.githubusercontent.com:aud": GITHUB_OIDC_AUDIENCE,
				},
				StringLike: {
					"token.actions.githubusercontent.com:sub": `repo:${githubRepo}:ref:refs/heads/main`,
				},
			}),
			maxSessionDuration: Duration.hours(1),
		});

		role.addToPolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
				resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
			}),
		);

		const account = Stack.of(this).account;
		role.addToPolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				actions: ["cloudfront:CreateInvalidation"],
				resources: [
					`arn:aws:cloudfront::${account}:distribution/${distribution.distributionId}`,
				],
			}),
		);

		this.roleArn = role.roleArn;
	}
}
