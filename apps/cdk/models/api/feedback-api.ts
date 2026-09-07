import { ApiResponse } from "./custom-entities-api";

export interface SendFeedbackPayload {
	message: string;
	subject?: string;
	email?: string;
}

export interface SendFeedbackData {
	messageId: string;
}

export type SendFeedbackResponse = ApiResponse<SendFeedbackData>;
