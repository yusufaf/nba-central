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
    GetUserPayload,
    GetUserResponse,
    CreateTeamPayload,
    CreateTeamResponse,
    GetTeamLogosResponse,
} from '@/models/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
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
    getUser: async (payload: GetUserPayload): Promise<GetUserResponse> => {
        const response = await api.post('/api/users/get', payload);
        return response.data;
    },
    saveUserData: async (payload: {
        clerkUserID: string;
        [key: string]: any;
    }): Promise<any> => {
        const response = await api.post('/api/users/save-data', payload);
        return response.data;
    },
};

// Teams API - matches TEAMS_ROUTES in CDK
export const teamApi = {
    createTeam: async (
        payload: CreateTeamPayload,
    ): Promise<CreateTeamResponse> => {
        const response = await api.post('/api/teams/create', payload);
        return response.data;
    },
};

// Data API - matches DATA_ROUTES in CDK
export const dataApi = {
    getTeamLogos: async (): Promise<GetTeamLogosResponse> => {
        const response = await api.post('/api/data/get-team-logos');
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
