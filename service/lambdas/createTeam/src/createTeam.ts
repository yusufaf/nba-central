import {
	APIGatewayProxyEventV2WithLambdaAuthorizer,
	APIGatewayProxyResultV2,
	Handler,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { AuthorizerContext } from "models/auth";
import { removeKeys } from "resources/dynamo/utilities";

const { mainTable = "" } = process.env;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (
	event: APIGatewayProxyEventV2WithLambdaAuthorizer<AuthorizerContext>,
	context,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event, context }, null, 4));

	const { sub: userUUID, username } = event.requestContext.authorizer.lambda;

	try {
		const teamUUID = randomUUID();
		const timestamp = new Date().getTime();
		const initialMetadata = {
			publiclyViewable: false,
		};
		const initialTeam = {
			PK: `userUUID#${userUUID}`,
			SK: `team#${teamUUID}`,
			createdAt: timestamp,
			description: "",
			favorited: false,
			label: "",
			lastViewed: timestamp,
			metadata: initialMetadata,
			updatedAt: timestamp,
			teamUUID,
			title: "Untitled Team",
			username,
			userUUID,
		};

		const putCommand = new PutCommand({
			TableName: mainTable,
			Item: initialTeam,
		});

		await docClient.send(putCommand);

		removeKeys(initialTeam);

		return {
			statusCode: 200,
			body: JSON.stringify({
				message: "Successfully created team",
				team: initialTeam,
			}),
		};
	} catch (err) {
		console.error(err);
		return {
			statusCode: 500,
			body: JSON.stringify({
				message: "Error",
			}),
		};
	}
};
