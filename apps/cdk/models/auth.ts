export type AuthorizerContext = {
    sub: string;
    userAttributes: { [key: string]: string };
    username: string;
 }