#!/usr/bin/env node
import "source-map-support/register";
import { config as dotEnvConfig } from "dotenv";
import { App } from "aws-cdk-lib";
import { TeamBuilderStack } from "../service/team-builder-stack";
import { TeamBuilderCertStack } from "../service/team-builder-stack/team-builder-cert-stack";

dotEnvConfig();

const app = new App();

const env = {
	account: process.env.account,
	region: process.env.region,
};

const appName = process.env.appName;
const deploymentType = process.env.deploymentType;

// Cross-region ACM certs (CloudFront + Cognito hosted UI both need
// us-east-1) and the Route 53-dependent web/auth domain resources are
// production-only. `development` has never needed a public domain and must
// not also try to claim auth.yusufaf.dev/nba.yusufaf.dev — see
// team-builder-cognito.ts for the Cognito custom-domain uniqueness gotcha.
let webCertificateArn: string | undefined;
let authCertificateArn: string | undefined;

if (deploymentType === "production") {
	const hostedZoneId = process.env.hostedZoneId;
	const hostedZoneName = process.env.hostedZoneName;

	if (!hostedZoneId || !hostedZoneName) {
		throw new Error(
			"Production deploys require hostedZoneId and hostedZoneName env vars to provision the nba.yusufaf.dev / auth.yusufaf.dev certificates.",
		);
	}

	const certStack = new TeamBuilderCertStack(
		app,
		`${appName}-${deploymentType}-cert-stack`,
		{
			env: { account: env.account, region: "us-east-1" },
			crossRegionReferences: true,
			appName,
			deploymentType,
			hostedZoneId,
			hostedZoneName,
		},
	);

	webCertificateArn = certStack.webCertificateArn;
	authCertificateArn = certStack.authCertificateArn;
}

new TeamBuilderStack(app, `${appName}-${deploymentType}-stack`, {
	env,
	appName,
	deploymentType,
	crossRegionReferences: true,
	hostedZoneId: process.env.hostedZoneId,
	hostedZoneName: process.env.hostedZoneName,
	webCertificateArn,
	authCertificateArn,
});
