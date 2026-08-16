import { describe, it, expect } from "vitest";
import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { TeamBuilderCognito } from "../../service/team-builder-stack/team-builder-cognito";
import { addRole } from "../../resources/roles";

// Construct-level CDK assertion test, following the isolated-construct
// pattern in test/stack/team-builder-dynamo.test.ts (dummy account/region,
// Template.fromStack, no real AWS calls).
//
// TeamBuilderCognito always creates the postConfirmationTrigger Lambda,
// which looks up its execution role by name
// (`${appName}-${deploymentType}-main-lambda-role`) from the module-level
// registry in resources/roles — normally populated by
// TeamBuilderAPI.createLambdaRoles(). Testing TeamBuilderCognito in
// isolation (no TeamBuilderAPI, matching the fast/no-esbuild-bundling
// pattern from the dynamo test) means that role has to be registered by
// hand first, scoped to the same stack, before construction.
const TEST_AUTH_CERT_ARN =
	"arn:aws:acm:us-east-1:123456789012:certificate/test-auth-cert";

const registerMainLambdaRole = (
	stack: Stack,
	appName: string,
	deploymentType: string,
) => {
	const roleName = `${appName}-${deploymentType}-main-lambda-role`;
	const role = new Role(stack, `${roleName}-fixture`, {
		assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
	});
	addRole(roleName, role, true);
};

const buildTemplate = (
	deploymentType: string,
	extraProps: Record<string, unknown> = {},
) => {
	const app = new App();
	const stack = new Stack(app, `test-stack-${deploymentType}`, {
		env: { account: "123456789012", region: "us-west-2" },
	});
	registerMainLambdaRole(stack, "team-builder", deploymentType);
	new TeamBuilderCognito(stack, "cognito", {
		env: { account: "123456789012", region: "us-west-2" },
		appName: "team-builder",
		deploymentType,
		...extraProps,
	});
	return Template.fromStack(stack);
};

const buildProductionTemplate = () =>
	buildTemplate("production", {
		hostedZoneId: "Z1234567890ABC",
		hostedZoneName: "yusufaf.dev",
		authCertificateArn: TEST_AUTH_CERT_ARN,
	});

describe("TeamBuilderCognito", () => {
	describe("UserPoolDomain production gating", () => {
		it("creates a UserPoolDomain with the auth.yusufaf.dev custom domain when deploymentType is production", () => {
			const template = buildProductionTemplate();
			template.resourceCountIs("AWS::Cognito::UserPoolDomain", 1);
			template.hasResourceProperties("AWS::Cognito::UserPoolDomain", {
				Domain: "auth.yusufaf.dev",
			});
		});

		it("creates zero UserPoolDomains for deploymentType development (the default)", () => {
			const template = buildTemplate("development");
			template.resourceCountIs("AWS::Cognito::UserPoolDomain", 0);
		});

		it("creates zero UserPoolDomains for any non-production deploymentType, even with hosted-zone/cert props present", () => {
			// Regression guard: passing production-shaped wiring props alone
			// must never be enough to provision the domain — only
			// deploymentType === 'production' does. Locks in the
			// single-owner-of-auth.yusufaf.dev constraint (Cognito custom
			// domains are globally unique across all of AWS).
			const template = buildTemplate("test", {
				hostedZoneId: "Z1234567890ABC",
				hostedZoneName: "yusufaf.dev",
				authCertificateArn: TEST_AUTH_CERT_ARN,
			});
			template.resourceCountIs("AWS::Cognito::UserPoolDomain", 0);
		});

		it("throws in production if hosted-zone/cert props are missing", () => {
			const app = new App();
			const stack = new Stack(app, "test-stack-production-missing-props", {
				env: { account: "123456789012", region: "us-west-2" },
			});
			registerMainLambdaRole(stack, "team-builder", "production");

			expect(
				() =>
					new TeamBuilderCognito(stack, "cognito", {
						env: { account: "123456789012", region: "us-west-2" },
						appName: "team-builder",
						deploymentType: "production",
					}),
			).toThrow(/hostedZoneId|hostedZoneName|authCertificateArn/);
		});
	});

	describe("UserPoolClient OAuth config", () => {
		it("enables the authorization code grant flow with openid/email/profile scopes", () => {
			const template = buildProductionTemplate();
			template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
				AllowedOAuthFlows: ["code"],
				AllowedOAuthScopes: Match.arrayWith([
					"openid",
					"email",
					"profile",
				]),
				AllowedOAuthFlowsUserPoolClient: true,
			});
		});

		it("sets the placeholder callback and logout URLs", () => {
			const template = buildProductionTemplate();
			template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
				CallbackURLs: ["https://nba.yusufaf.dev/auth/callback"],
				LogoutURLs: ["https://nba.yusufaf.dev"],
			});
		});

		it("configures OAuth on the client even in development (client config is not gated)", () => {
			const template = buildTemplate("development");
			template.resourceCountIs("AWS::Cognito::UserPoolClient", 1);
			template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
				AllowedOAuthFlows: ["code"],
			});
		});
	});
});
