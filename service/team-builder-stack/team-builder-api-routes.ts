import { HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";

export type ApiRoute = {
	route: string;
	lambdaName: string;
	methods?: HttpMethod[] | undefined;
};

const FILES_PREFIX = `/api/files`;
const USERS_PREFIX = `/api/users`;
const TEAMS_PREFIX = `/api/teams`;
const DATA_PREFIX = `/api/data`;
const CUSTOM_ENTITIES_PREFIX = `/api/custom-entities`;

export const FILES_ROUTES: ApiRoute[] = [
	{
		route: `${FILES_PREFIX}/initiate-multipart-upload`,
		lambdaName: "initiateMultipartUpload",
	},
	{
		route: `${FILES_PREFIX}/complete-multipart-upload`,
		lambdaName: "completeMultipartUpload",
	},
	{
		route: `${FILES_PREFIX}/get-multipart-signed-upload-urls`,
		lambdaName: "getMultipartSignedUploadUrls",
	},
	{
		route: `${FILES_PREFIX}/delete-file`,
		lambdaName: "deleteFile",
	},
];

export const USERS_ROUTES: ApiRoute[] = [
	// {
	// 	route: `${USERS_PREFIX}/get`,
	// 	lambdaName: "getUser",
	// },
	{
		route: `${USERS_PREFIX}/save-data`,
		lambdaName: "saveUserData",
	},
];

export const TEAMS_ROUTES: ApiRoute[] = [
	{
		route: `${TEAMS_PREFIX}/create`,
		lambdaName: "createTeam",
	},
];

export const DATA_ROUTES: ApiRoute[] = [
	{
		route: `${DATA_PREFIX}/get-team-logos`,
		lambdaName: "getTeamLogos",
		methods: [HttpMethod.GET],
	},
	{
		route: `${DATA_PREFIX}/get-players`,
		lambdaName: "getPlayers",
		methods: [HttpMethod.GET],
	},
	{
		route: `${DATA_PREFIX}/get-player-stats`,
		lambdaName: "getPlayerStats",
		methods: [HttpMethod.GET],
	},
];

export const NEWS_ROUTES: ApiRoute[] = [
	{
		route: `/api/news/get`,
		lambdaName: "getNews",
		methods: [HttpMethod.GET],
	},
];

export const CUSTOM_ENTITIES_ROUTES: ApiRoute[] = [
	// GM routes
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/gm/create`,
		lambdaName: "createCustomGM",
		methods: [HttpMethod.POST],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/gm/list`,
		lambdaName: "listCustomGMs",
		methods: [HttpMethod.GET],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/gm/update`,
		lambdaName: "updateCustomGM",
		methods: [HttpMethod.PUT],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/gm/delete/{gmUUID}`,
		lambdaName: "deleteCustomGM",
		methods: [HttpMethod.DELETE],
	},
	// Coach routes
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/coach/create`,
		lambdaName: "createCustomCoach",
		methods: [HttpMethod.POST],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/coach/list`,
		lambdaName: "listCustomCoaches",
		methods: [HttpMethod.GET],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/coach/update`,
		lambdaName: "updateCustomCoach",
		methods: [HttpMethod.PUT],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/coach/delete/{coachUUID}`,
		lambdaName: "deleteCustomCoach",
		methods: [HttpMethod.DELETE],
	},
	// Player routes
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/player/create`,
		lambdaName: "createCustomPlayer",
		methods: [HttpMethod.POST],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/player/list`,
		lambdaName: "listCustomPlayers",
		methods: [HttpMethod.GET],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/player/update`,
		lambdaName: "updateCustomPlayer",
		methods: [HttpMethod.PUT],
	},
	{
		route: `${CUSTOM_ENTITIES_PREFIX}/player/delete/{playerUUID}`,
		lambdaName: "deleteCustomPlayer",
		methods: [HttpMethod.DELETE],
	},
];

// DATA_ROUTES and NEWS_ROUTES are read-only reference data the frontend
// fetches on every page load for signed-out visitors too (e.g. App.vue's
// team-logo fetch on mount) — gating them behind the authorizer would 403
// the public site. Everything that reads or writes user-owned data stays
// authenticated.
export const PUBLIC_ROUTES: ApiRoute[] = [...DATA_ROUTES, ...NEWS_ROUTES];
export const PRIVATE_ROUTES: ApiRoute[] = [
	...FILES_ROUTES,
	...USERS_ROUTES,
	...TEAMS_ROUTES,
	...CUSTOM_ENTITIES_ROUTES,
];
