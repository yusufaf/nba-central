import { Duration, RemovalPolicy } from "aws-cdk-lib";
import {
	ComparisonOperator,
	TreatMissingData,
} from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { CronOptions, Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import {
	NodejsFunction,
	NodejsFunctionProps,
} from "aws-cdk-lib/aws-lambda-nodejs";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import path from "path";
import { ExtendedStackProps, LambdaAlerts } from "../../models/stack";
import { layerARNLookup } from "../../resources/lambda";
import { getRole } from "../../resources/roles";

// A month covers four runs of the weekly jobs.
export const LAMBDA_LOG_RETENTION = RetentionDays.ONE_MONTH;

export const ERROR_ALARM_PERIOD = Duration.minutes(5);
// Two hours of 5-minute periods, so a job that fails every run (every 15
// minutes at worst: fetchNewsCron, or setSeasonContextData's injuries rule
// if it keeps crashing) holds one alarm instead of re-alarming per run.
export const ERROR_ALARM_EVALUATION_PERIODS = 24;

export type LambdaSchedule = { rate: Duration } | { cron: CronOptions };

export const toSchedule = (schedule: LambdaSchedule): Schedule =>
	"cron" in schedule ? Schedule.cron(schedule.cron) : Schedule.rate(schedule.rate);

export interface TeamBuilderLambdaConfig {
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
		ruleName?: string;
	} & LambdaSchedule;

	// Layer configuration
	layers?: string[];

	// Additional function configuration to override defaults
	functionProps?: Partial<NodejsFunctionProps>;

	/**
	 * Scheduled (async-invoked) Lambdas only. Emails `stackProps.alerts.topic`
	 * when the function errors in `failuresToAlarm` (default 1) of the last 24
	 * five-minute periods, and sends an event that fails every retry to
	 * `stackProps.alerts.failedEvents`. API Lambdas are invoked synchronously,
	 * so neither applies to them.
	 */
	monitor?: { failuresToAlarm?: number };
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

		if (config.monitor && !config.stackProps.alerts) {
			throw new Error(`${config.functionName}: monitor needs stackProps.alerts`);
		}

		const functionName = this.getResourceName(config.functionName);
		const role = getRole(this.getResourceName("main-lambda-role", true)); // Force deployment type for role name

		// A CDK-owned group, not Lambda's auto-created /aws/lambda/<name>, so
		// retention is set here. Its name is generated, so a retained group
		// could never be reattached: delete it with the function.
		const logGroup = new LogGroup(this, `${functionName}-logs`, {
			retention: LAMBDA_LOG_RETENTION,
			removalPolicy: RemovalPolicy.DESTROY,
		});

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
			logGroup,
			// Ahead of functionProps, so a retryAttempts there lands in the
			// same EventInvokeConfig.
			...(config.monitor && {
				onFailure: new SqsDestination(config.stackProps.alerts!.failedEvents),
			}),
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

		if (config.monitor) {
			this.addErrorAlarm(
				functionName,
				config.stackProps.alerts!,
				config.monitor.failuresToAlarm ?? 1,
			);
		}

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
				schedule: toSchedule(config.schedule),
				targets: [new LambdaFunction(this.lambdaFunction)],
			});
		}
	}
	// No OK action: a recovery email is noise.
	private addErrorAlarm(
		functionName: string,
		{ topic, failedEvents }: LambdaAlerts,
		failuresToAlarm: number,
	) {
		const periods = failuresToAlarm > 1 ? ` in ${failuresToAlarm} 5-minute periods` : "";
		this.lambdaFunction
			.metricErrors({ period: ERROR_ALARM_PERIOD, statistic: "Sum" })
			.createAlarm(this, `${functionName}-errors-alarm`, {
				alarmName: `${functionName}-errors`,
				alarmDescription: `${functionName} threw or timed out${periods} within two hours. Events that failed every retry wait in ${failedEvents.queueName}; logs are linked from the function's Monitor tab.`,
				threshold: 1,
				comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
				evaluationPeriods: ERROR_ALARM_EVALUATION_PERIODS,
				datapointsToAlarm: failuresToAlarm,
				treatMissingData: TreatMissingData.NOT_BREACHING,
			})
			.addAlarmAction(new SnsAction(topic));
	}
}
