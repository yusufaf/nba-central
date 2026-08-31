import axios from 'axios';
import type {
    InitiateMultipartUploadPayload,
    InitiateMultipartUploadResponse,
    CompleteMultipartUploadPayload,
    CompleteMultipartUploadResponse,
    GetMultipartSignedUrlsPayload,
    GetMultipartSignedUrlsResponse,
    DeleteFilePayload,
    DeleteFileResponse,
    SaveTeamPayload,
    UpdateTeamPayload,
    CreateTeamResponse,
    ListTeamsResponse,
    GetTeamResponse,
    UpdateTeamResponse,
    DeleteTeamResponse,
    GetTeamLogosResponse,
    GetNewsResponse,
    GetPlayersParams,
    GetPlayersResponse,
    GetPlayerStatsResponse,
} from '@/models/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Wired up by App.vue on mount, once useLogto() is available inside a
// component's setup context (this module isn't one). Before that happens —
// or if the user isn't signed in — requests simply go out unauthenticated,
// same as today; apiAuthorizer.ts is what actually enforces auth.
type AccessTokenGetter = () => Promise<string | undefined>;
let getAccessToken: AccessTokenGetter | undefined;

export const setAccessTokenGetter = (getter: AccessTokenGetter): void => {
    getAccessToken = getter;
};

api.interceptors.request.use(async (config) => {
    const token = await getAccessToken?.();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Files API - matches FILES_ROUTES in CDK
export const fileApi = {
    initiateMultipartUpload: async (
        payload: InitiateMultipartUploadPayload,
    ): Promise<InitiateMultipartUploadResponse> => {
        const response = await api.post(
            '/api/files/initiate-multipart-upload',
            payload,
        );
        return response.data;
    },
    completeMultipartUpload: async (
        payload: CompleteMultipartUploadPayload,
    ): Promise<CompleteMultipartUploadResponse> => {
        const response = await api.post(
            '/api/files/complete-multipart-upload',
            payload,
        );
        return response.data;
    },
    getMultipartSignedUploadUrls: async (
        payload: GetMultipartSignedUrlsPayload,
    ): Promise<GetMultipartSignedUrlsResponse> => {
        const response = await api.post(
            '/api/files/get-multipart-signed-upload-urls',
            payload,
        );
        return response.data;
    },
    deleteFile: async (
        payload: DeleteFilePayload,
    ): Promise<DeleteFileResponse> => {
        const response = await api.post('/api/files/delete-file', payload);
        return response.data;
    },
};

// Users API - matches USERS_ROUTES in CDK
export const userApi = {
    saveUserData: async (payload: {
        userId: string;
        [key: string]: any;
    }): Promise<any> => {
        const response = await api.post('/api/users/save-data', payload);
        return response.data;
    },
};

// Teams API - matches TEAMS_ROUTES in CDK
export const teamApi = {
    createTeam: async (
        payload: SaveTeamPayload,
    ): Promise<CreateTeamResponse> => {
        const response = await api.post('/api/teams/create', payload);
        return response.data;
    },
    listTeams: async (): Promise<ListTeamsResponse> => {
        const response = await api.get('/api/teams/list');
        return response.data;
    },
    getTeam: async (teamUUID: string): Promise<GetTeamResponse> => {
        const response = await api.get(`/api/teams/get/${teamUUID}`);
        return response.data;
    },
    updateTeam: async (
        payload: UpdateTeamPayload,
    ): Promise<UpdateTeamResponse> => {
        const response = await api.put('/api/teams/update', payload);
        return response.data;
    },
    deleteTeam: async (teamUUID: string): Promise<DeleteTeamResponse> => {
        const response = await api.delete(`/api/teams/delete/${teamUUID}`);
        return response.data;
    },
};

// Data API - matches DATA_ROUTES in CDK
export const dataApi = {
    getTeamLogos: async (): Promise<GetTeamLogosResponse> => {
        const response = await api.get('/api/data/get-team-logos');
        return response.data;
    },
    getPlayers: async (
        params: GetPlayersParams = {},
    ): Promise<GetPlayersResponse> => {
        const response = await api.get<GetPlayersResponse>(
            '/api/data/get-players',
            { params },
        );
        return response.data;
    },
    getPlayerStats: async (
        playerId: string,
    ): Promise<GetPlayerStatsResponse> => {
        const response = await api.get<GetPlayerStatsResponse>(
            '/api/data/get-player-stats',
            { params: { playerId } },
        );
        return response.data;
    },
};

// News API
export const newsApi = {
    getNews: async (): Promise<GetNewsResponse> => {
        const response = await api.get<GetNewsResponse>('/api/news/get');
        return response.data;
    },
};

// Custom GM API
export const customGMApi = {
    create: async (data: { name: string; teams: string[] }) => {
        const response = await api.post('/api/custom-entities/gm/create', data);
        return response.data;
    },
    list: async () => {
        const response = await api.get('/api/custom-entities/gm/list');
        return response.data;
    },
    update: async (gmUUID: string, data: { name: string; teams: string[] }) => {
        const response = await api.put('/api/custom-entities/gm/update', { gmUUID, ...data });
        return response.data;
    },
    delete: async (gmUUID: string) => {
        const response = await api.delete(`/api/custom-entities/gm/delete/${gmUUID}`);
        return response.data;
    },
};

// Custom Coach API
export const customCoachApi = {
    create: async (data: { name: string; overallRating: number; specialty: string }) => {
        const response = await api.post('/api/custom-entities/coach/create', data);
        return response.data;
    },
    list: async () => {
        const response = await api.get('/api/custom-entities/coach/list');
        return response.data;
    },
    update: async (coachUUID: string, data: { name: string; overallRating: number; specialty: string }) => {
        const response = await api.put('/api/custom-entities/coach/update', { coachUUID, ...data });
        return response.data;
    },
    delete: async (coachUUID: string) => {
        const response = await api.delete(`/api/custom-entities/coach/delete/${coachUUID}`);
        return response.data;
    },
};

// Custom Player API
export const customPlayerApi = {
    create: async (data: {
        name: string;
        position: string;
        heightFeet: number;
        heightInches: number;
        weightPounds: number;
        overallRating: number;
    }) => {
        const response = await api.post('/api/custom-entities/player/create', data);
        return response.data;
    },
    list: async () => {
        const response = await api.get('/api/custom-entities/player/list');
        return response.data;
    },
    update: async (playerUUID: string, data: {
        name: string;
        position: string;
        heightFeet: number;
        heightInches: number;
        weightPounds: number;
        overallRating: number;
    }) => {
        const response = await api.put('/api/custom-entities/player/update', { playerUUID, ...data });
        return response.data;
    },
    delete: async (playerUUID: string) => {
        const response = await api.delete(`/api/custom-entities/player/delete/${playerUUID}`);
        return response.data;
    },
};
