import { CfnStage, HttpApi, ThrottleSettings } from "aws-cdk-lib/aws-apigatewayv2";

export const API_THROTTLE: ThrottleSettings = { rateLimit: 50, burstLimit: 100 };

/**
 * HttpApi takes no throttle for its auto-created $default stage, which is
 * the one CloudFront fronts, so this sets it on the L1 stage. The limit is
 * a default for each route separately, not a total for the API and not per
 * client: it caps how hard one hammered endpoint can drive its Lambda, and
 * API Gateway answers 429 before any Lambda runs.
 */
export const throttleDefaultStage = (api: HttpApi) => {
	const stage = api.defaultStage!.node.defaultChild as CfnStage;
	stage.defaultRouteSettings = {
		throttlingRateLimit: API_THROTTLE.rateLimit,
		throttlingBurstLimit: API_THROTTLE.burstLimit,
	};
};
