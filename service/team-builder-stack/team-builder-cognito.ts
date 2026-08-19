import { Duration } from "aws-cdk-lib";
import {
	AccountRecovery,
	OAuthScope,
	UserPool,
	UserPoolClient,
	UserPoolOperation,
} from "aws-cdk-lib/aws-cognito";
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
				// module doc). Placeholder callback/logout URLs, kept
				// adjustable now that this UserPool has no custom domain.
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

		// This construct used to provision a Cognito hosted-UI custom domain
		// at auth.yusufaf.dev for production deploys (UserPoolDomain +
		// Route 53 ARecord). That's gone — auth.yusufaf.dev is now Logto on
		// Fly (logto-flyio), not Cognito. See the auth migration plan for
		// context. This UserPool has no custom domain; it's slated for
		// deletion once nba-central and Quizaroni are both verified live on
		// Logto.
	}
}
