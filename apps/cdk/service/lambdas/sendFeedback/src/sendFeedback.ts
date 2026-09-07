import {
    APIGatewayProxyEventV2WithLambdaAuthorizer,
    APIGatewayProxyResultV2,
    Handler,
} from "aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { AuthorizerContext } from "models/auth";
import { SendFeedbackPayload, SendFeedbackResponse } from "models/api/feedback-api";
import { parseRequestBody } from "utilities/request-body";

const {
    FEEDBACK_SES_REGION = "",
    FEEDBACK_FROM_ADDRESS = "",
    FEEDBACK_TO_ADDRESS = "",
} = process.env;

const MAX_MESSAGE_LENGTH = 5000;
const MAX_SUBJECT_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The sending identity (auth.yusufaf.dev) is only verified in us-east-1, not
// this Lambda's own region, so the client can't infer it from AWS_REGION.
const sesClient = new SESClient({ region: FEEDBACK_SES_REGION });

export const handler: Handler = async (
    event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
    context
): Promise<APIGatewayProxyResultV2> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const parsed = parseRequestBody<SendFeedbackPayload>(event.body, {
            message: "string",
        });
        if (!parsed.valid) {
            const response: SendFeedbackResponse = {
                success: false,
                error: parsed.error,
            };
            return {
                statusCode: 400,
                body: JSON.stringify(response),
            };
        }
        const { message, subject, email } = parsed.body;

        const sub = event.requestContext?.authorizer?.lambda?.sub;
        const username = event.requestContext?.authorizer?.lambda?.username;
        if (!sub) {
            const response: SendFeedbackResponse = {
                success: false,
                error: "Forbidden",
            };
            return {
                statusCode: 403,
                body: JSON.stringify(response),
            };
        }

        if (message.length > MAX_MESSAGE_LENGTH) {
            const response: SendFeedbackResponse = {
                success: false,
                error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer`,
            };
            return {
                statusCode: 400,
                body: JSON.stringify(response),
            };
        }
        if (subject !== undefined && subject.length > MAX_SUBJECT_LENGTH) {
            const response: SendFeedbackResponse = {
                success: false,
                error: `subject must be ${MAX_SUBJECT_LENGTH} characters or fewer`,
            };
            return {
                statusCode: 400,
                body: JSON.stringify(response),
            };
        }
        // SES rejects the whole send on a malformed ReplyToAddresses entry,
        // which would otherwise surface as a confusing 500 further down. An
        // empty string is treated as "not provided" (matching the `email ?`
        // check below), not as an invalid address.
        if (email && !EMAIL_PATTERN.test(email)) {
            const response: SendFeedbackResponse = {
                success: false,
                error: "email must be a valid email address",
            };
            return {
                statusCode: 400,
                body: JSON.stringify(response),
            };
        }

        const bodyText = [
            `From user: ${username ?? "unknown"} (${sub})`,
            email ? `Reply-to: ${email}` : undefined,
            "",
            message,
        ]
            .filter((line) => line !== undefined)
            .join("\n");

        const sendEmailCommand = new SendEmailCommand({
            Source: FEEDBACK_FROM_ADDRESS,
            Destination: {
                ToAddresses: [FEEDBACK_TO_ADDRESS],
            },
            ReplyToAddresses: email ? [email] : undefined,
            Message: {
                Subject: {
                    Data: `[NBA Central] ${subject ?? "Feedback"}`,
                },
                Body: {
                    Text: {
                        Data: bodyText,
                    },
                },
            },
        });
        const result = await sesClient.send(sendEmailCommand);

        const response: SendFeedbackResponse = {
            success: true,
            data: { messageId: result.MessageId ?? "" },
        };
        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };
    } catch (err: any) {
        console.error("Error sending feedback:", err);
        const response: SendFeedbackResponse = {
            success: false,
            error: err.message || "Failed to send feedback",
        };
        return {
            statusCode: 500,
            body: JSON.stringify(response),
        };
    }
};
