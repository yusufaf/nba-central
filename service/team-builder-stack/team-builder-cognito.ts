import { Duration } from "aws-cdk-lib";
import {
	AccountRecovery,
	OAuthScope,
	UserPool,
	UserPoolClient,
	UserPoolDomain,
	UserPoolOperation,
} from "aws-cdk-lib/aws-cognito";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { HostedZone, ARecord, RecordTarget } from "aws-cdk-lib/aws-route53";
import { UserPoolDomainTarget } from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import postConfirmationTrigger from "../lambdas/postConfirmationTrigger";
import { ExtendedStackProps } from "models/stack";

export class TeamBuilderCognito extends Construct {
	constructor(scope: Construct, id: string, props: ExtendedStackProps) {
		super(scope, id);
		const {
			appName = "team-builder",
			deploymentType = "development",
			env,
			hostedZoneId,
			hostedZoneName,
			authCertificateArn,
		} = props;

		const { account = "", region = "" } = env!;

		const userPoolName = `${appName}-${deploymentType}-users`;
		const userPool = new UserPool(this, userPoolName, {
			userPoolName,
			standardAttributes: {
				email: {
					required: true,
				},
			},
			passwordPolicy: {
				tempPasswordValidity: Duration.days(30),
			},
			signInAliases: {
				email: true,
				username: true,
				preferredUsername: true,
			},
			accountRecovery: AccountRecovery.EMAIL_ONLY,
			userVerification: {
				emailSubject: `Your TeamBuilder verification code`,
			},
			userInvitation: {
				emailSubject: `Your TeamBuilder temporary password`,
			},
			selfSignUpEnabled: true,
		});

		const lambdaProps = {
			construct: this,
			props,
		};

		const postConfirmationTriggerLambda = postConfirmationTrigger({
			...lambdaProps,
		});
		userPool.addTrigger(
			UserPoolOperation.POST_CONFIRMATION,
			postConfirmationTriggerLambda,
		);

		const { userPoolId } = userPool;
		const userPoolClientName = `${appName}-${deploymentType}-user-pool-client`;
		const mainUserPoolClient = new UserPoolClient(
			this,
			userPoolClientName,
			{
				userPool,
				userPoolClientName,
				refreshTokenValidity: Duration.days(30),
				accessTokenValidity: Duration.days(1),
				idTokenValidity: Duration.days(1),
				// No frontend route consumes these yet (nba-central's live
				// auth is Clerk, not Cognito — see team-builder-cognito.ts
				// module doc). Placeholder callback/logout URLs so the
				// hosted UI domain below is fully wired and adjustable later
				// without re-provisioning the domain.
				oAuth: {
					flows: {
						authorizationCodeGrant: true,
					},
					scopes: [
						OAuthScope.OPENID,
						OAuthScope.EMAIL,
						OAuthScope.PROFILE,
					],
					callbackUrls: ["https://nba.yusufaf.dev/auth/callback"],
					logoutUrls: ["https://nba.yusufaf.dev"],
				},
			},
		);

		// Cognito custom domains are globally unique across all of AWS — one
		// hostname, one User Pool. If both `development` and `production`
		// tried to claim auth.yusufaf.dev, the second deploy would fail with
		// a domain-already-associated CloudFormation error. Hard gate to
		// production only — not an oversight, a genuine correctness
		// requirement. nba-central keeps using Clerk; this domain is
		// reserved infra only (see the plan's Phase 5 section for the
		// larger, separately-scoped Clerk-to-Cognito migration).
		if (deploymentType === "production") {
			if (!hostedZoneId || !hostedZoneName || !authCertificateArn) {
				throw new Error(
					"TeamBuilderCognito production deploys require hostedZoneId, hostedZoneName, and authCertificateArn to provision the auth.yusufaf.dev UserPoolDomain.",
				);
			}

			const authCertificate = Certificate.fromCertificateArn(
				this,
				`${appName}-${deploymentType}-auth-cert`,
				authCertificateArn,
			);

			const userPoolDomainNameAndId = `${appName}-${deploymentType}-user-pool-domain`;
			const userPoolDomain = new UserPoolDomain(
				this,
				userPoolDomainNameAndId,
				{
					userPool,
					customDomain: {
						domainName: "auth.yusufaf.dev",
						certificate: authCertificate,
					},
				},
			);

			const hostedZoneNameAndId = `${appName}-${deploymentType}-auth-hosted-zone`;
			const hostedZone = HostedZone.fromHostedZoneAttributes(
				this,
				hostedZoneNameAndId,
				{
					hostedZoneId,
					zoneName: hostedZoneName,
				},
			);

			new ARecord(this, `${appName}-${deploymentType}-auth-a-record`, {
				zone: hostedZone,
				recordName: "auth",
				target: RecordTarget.fromAlias(
					new UserPoolDomainTarget(userPoolDomain),
				),
			});
		}
	}
}
