import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewaySimpleAuthorizerWithContextResult,
    Handler,
} from "aws-lambda";
import { CognitoIdentityProviderClient, GetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";

type AuthorizerContext = { [key: string]: any }

const { userPoolId = "", clientId = "" } = process.env;

const cognitoClient = new CognitoIdentityProviderClient({});

console.log({userPoolId, clientId })
// Verifier that expects valid access tokens:
const verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: "access",
    clientId,
});

export const handler: Handler = async (
    event: APIGatewayRequestAuthorizerEvent,
    context
): Promise<APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>> => {
    console.log(JSON.stringify({ event, context }, null, 4));

    try {
        const authorization = event.headers?.Authorization ?? event.headers?.authorization ?? "";
        const [accessToken, idToken] = authorization.split(" ");
        console.log({accessToken, idToken})

        const { userAttributes, username } = await getCognitoUserAttributes(accessToken, idToken);

        const payload = await verifier.verify(accessToken);
        console.log("Token is valid. Payload:", payload);

        return {
            isAuthorized: true,
            context: {
                username,
                userAttributes,
                sub: payload.sub,
            }
        }
    } catch (err) {
        console.error(err);

        return {
            isAuthorized: false,
            context: {

            },
        }
    }
};

const getCognitoUserAttributes = async (accessToken: string, idToken: string) => {
    const getUserCommand = new GetUserCommand({
        AccessToken: accessToken
    });
    const response = await cognitoClient.send(getUserCommand);
    const { UserAttributes, Username: username} = response;

    // Reduce user attributes into an object instead of an array
    const userAttributes = (UserAttributes ?? []).reduce((acc, attribute ) => {
        const { Name, Value } = attribute
        if (!Name || !Value) {
            return acc;
        }
        // @ts-ignore Using Name as index type
        acc[Name] = Value;
        return acc;
    }, {})

    return {
        userAttributes,
        username,
    };
}
