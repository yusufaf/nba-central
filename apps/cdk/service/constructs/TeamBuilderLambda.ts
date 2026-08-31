import { Duration } from "aws-cdk-lib";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import {
	NodejsFunction,
	NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import path from "path";
import { ExtendedStackProps } from "../../models/stack";
import { layerARNLookup } from "../../resources/lambda";
import { getRole } from "../../resources/roles";

interface TeamBuilderLambdaConfig {
	// Required configurations
	functionName: string;
	stackProps: ExtendedStackProps;

	// Lambda configuration
	bundling?: NodejsFunctionProps["bundling"];
	environment?: { [key: string]: string };
	memorySize?: number;
	runtime?: Runtime;
	timeout?: Duration;
	deployToTypes?: string[];
	/** If true, won't include deployment type in function name */
	excludeDeploymentType?: boolean;

	// Schedule configuration
	schedule?: {
		description?: string;
		enabled: boolean;
		rate: Duration;
		ruleName?: string;
	};

	// Layer configuration
	layers?: string[];

	// Additional function configuration to override defaults
	functionProps?: Partial<NodejsFunctionProps>;
}

export class TeamBuilderLambda extends Construct {
	public readonly lambdaFunction: NodejsFunction;
	private readonly config: TeamBuilderLambdaConfig;

	private getResourceName(
		baseName: string,
		forceDeploymentType: boolean = false,
	): string {
		const { appName, deploymentType = "" } = this.config.stackProps;
		// Always include deployment type if forceDeploymentType is true, otherwise respect excludeDeploymentType
		return forceDeploymentType || !this.config.excludeDeploymentType
			? `${appName}-${deploymentType}-${baseName}`
			: `${appName}-${baseName}`;
	}

	constructor(scope: Construct, id: string, config: TeamBuilderLambdaConfig) {
		super(scope, id);
		this.config = config;

		// Check if lambda should be deployed to this deployment type
		if (
			config.deployToTypes &&
			!config.deployToTypes.includes(
				config.stackProps.deploymentType || "",
			)
		) {
			return;
		}

		const functionName = this.getResourceName(config.functionName);
		const role = getRole(this.getResourceName("main-lambda-role", true)); // Force deployment type for role name

		// Construct the Lambda configuration
		let nodejsFunctionProps: NodejsFunctionProps = {
			bundling: config.bundling,
			entry: path.join(
				__dirname,
				`../../service/lambdas/${config.functionName}/src/${config.functionName}.ts`,
			),
			environment: {
				deploymentType: config.stackProps.deploymentType || "",
				NODE_OPTIONS: "--enable-source-maps",
				...config.environment,
			},
			functionName,
			handler: "handler",
			memorySize: config.memorySize || 1024,
			role,
			runtime: config.runtime || Runtime.NODEJS_22_X,
			timeout: config.timeout || Duration.seconds(30),
			...config.functionProps,
		};

		// Handle layers
		if (config.layers?.length) {
			const layerVersions = config.layers.map((layerName, index) =>
				LayerVersion.fromLayerVersionArn(
					this,
					`${functionName}-layer-${index}`,
					layerARNLookup[layerName],
				),
			);

			// Note: layer-provided packages are deliberately NOT marked
			// external. node-fetch v3 is ESM-only, so requiring it from the
			// layer at runtime fails with ERR_REQUIRE_ESM - esbuild has to
			// bundle it into the CommonJS output instead. The layers stay
			// attached, but the bundle is what actually gets used.
			nodejsFunctionProps = {
				...nodejsFunctionProps,
				layers: layerVersions,
			};
		}

		// Create the Lambda function
		this.lambdaFunction = new NodejsFunction(
			this,
			functionName,
			nodejsFunctionProps,
		);

		// Add CloudWatch Event Rule if schedule is specified
		if (config.schedule?.enabled) {
			new Rule(this, `${functionName}-rule`, {
				description:
					config.schedule.description ||
					`Scheduled execution of ${config.functionName}`,
				ruleName:
					config.schedule.ruleName ||
					this.getResourceName(
						`${config.functionName}-schedule`,
						true,
					), 
				schedule: Schedule.rate(config.schedule.rate),
				targets: [new LambdaFunction(this.lambdaFunction)],
			});
		}
	}
}
