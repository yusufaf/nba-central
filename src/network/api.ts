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
    initiateMultipartUpload: async (payload: InitiateMultipartUploadPayload): Promise<InitiateMultipartUploadResponse> => {
        const response = await api.post('/api/files/initiate-multipart-upload', payload);
        return response.data;
    },
    completeMultipartUpload: async (payload: CompleteMultipartUploadPayload): Promise<CompleteMultipartUploadResponse> => {
        const response = await api.post('/api/files/complete-multipart-upload', payload);
        return response.data;
    },
    getMultipartSignedUploadUrls: async (payload: GetMultipartSignedUrlsPayload): Promise<GetMultipartSignedUrlsResponse> => {
        const response = await api.post('/api/files/get-multipart-signed-upload-urls', payload);
        return response.data;
    },
    deleteFile: async (payload: DeleteFilePayload): Promise<DeleteFileResponse> => {
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
};

// Teams API - matches TEAMS_ROUTES in CDK
export const teamApi = {
    createTeam: async (payload: CreateTeamPayload): Promise<CreateTeamResponse> => {
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
