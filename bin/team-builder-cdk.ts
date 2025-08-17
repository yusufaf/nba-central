#!/usr/bin/env node
import "source-map-support/register";
import { config as dotEnvConfig } from "dotenv";
import { App } from "aws-cdk-lib";
import { TeamBuilderStack } from "../service/team-builder-stack";

dotEnvConfig();

const app = new App();

const env = {
	account: process.env.account,
	region: process.env.region,
};

const appName = process.env.appName;
const deploymentType = process.env.deploymentType;

new TeamBuilderStack(app, `${appName}-${deploymentType}-stack`, {
	env,
	appName,
	deploymentType,
});
