import {
    APIGatewayRequestAuthorizerEvent,
    APIGatewaySimpleAuthorizerWithContextResult,
    Handler,
} from "aws-lambda";
import { createRemoteJWKSet, jwtVerify } from "jose";

type AuthorizerContext = { [key: string]: any };

const { logtoEndpoint = "", apiResource = "" } = process.env;

// Logto's OIDC issuer is the endpoint plus /oidc (see the OIDC discovery
// document at `${logtoEndpoint}/oidc/.well-known/openid-configuration`).
const issuer = `${logtoEndpoint}/oidc`;
const jwksUri = new URL(`${issuer}/jwks`);

// createRemoteJWKSet caches the key set in module scope, so a warm Lambda
// invocation verifies locally with no network call — unlike the Cognito
// version this replaces, which called GetUser on every single request.
const jwks = createRemoteJWKSet(jwksUri);

export const handler: Handler = async (
    event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>> => {
    try {
        const authorization =
            event.headers?.Authorization ?? event.headers?.authorization ?? "";
        const [, accessToken] = authorization.split(" ");

        if (!accessToken) {
            throw new Error("Missing bearer token");
        }

        const { payload } = await jwtVerify(accessToken, jwks, {
            issuer,
            // Reject a token issued for a different project's API resource —
            // e.g. a Quizaroni access token must not authorize NBA Central
            // requests. See the auth migration plan's Security section.
            audience: apiResource,
        });

        // username comes from a Logto Custom JWT (Console > Custom JWT > User
        // access token) baking `context.user.username` into the access
        // token's claims, so this stays a local verify with no per-request
        // network call — see logto-flyio's console setup notes.
        const { sub, username } = payload as { sub?: string; username?: string };

        return {
            isAuthorized: true,
            context: {
                username,
                userAttributes: {},
                sub,
            },
        };
    } catch (err) {
        console.error("Authorization failed:", err);

        return {
            isAuthorized: false,
            context: {},
        };
    }
};
