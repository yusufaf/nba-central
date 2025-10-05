import { SES } from "@aws-sdk/client-ses";
import { PostConfirmationTriggerHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const { usersTable = "" } = process.env;

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

/**
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
 */
export const handler: PostConfirmationTriggerHandler = async (
    event,
    context
): Promise<any> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    const { request, userName: username, triggerSource } = event;
    const { clientMetadata, userAttributes } = request;
    const {
        email,
        email_verified: emailVerified,
        sub: userUUID,
    } = userAttributes;

    try {
        switch (triggerSource) {
            case "PostConfirmation_ConfirmSignUp":
                const newUserItem = {
                    PK: `user#${userUUID}`,
                    SK: "userData",
                    createdAt: Date.now(),
                    email,
                    emailVerified,
                    metadata: {},
                    updatedAt: Date.now(),
                    username,
                    userUUID,
                };
                const putCommand = new PutCommand({
                    TableName: usersTable,
                    Item: newUserItem,
                });
                await docClient.send(putCommand);

                break;
            case "PostConfirmation_ConfirmForgotPassword":
                break;
        }

        return event;
    } catch (error) {
        console.error(error);

        return event;
    }
};
