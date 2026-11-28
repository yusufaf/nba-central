import { defineStore } from "pinia";
import { isAxiosError } from "axios";
import { teamApi } from "@/network/api";
import { getApiErrorMessage } from "@/composables/useApiErrorMessage";
import { SESSION_EXPIRED_MESSAGE } from "@/composables/useSessionExpiry";
import type {
    SaveTeamPayload,
    UpdateTeamPayload,
    PublishTeamPayload,
    TeamSummary,
} from "@/models/api";

interface UserTeamsState {
    teams: TeamSummary[];
    loading: boolean;
    error: string | null;
}

// The signed-in user's own saved teams.
export const useUserTeamsStore = defineStore("userTeams", {
    state: (): UserTeamsState => ({
        teams: [],
        loading: false,
        error: null,
    }),

    actions: {
        async fetch() {
            this.loading = true;
            this.error = null;

            try {
                const response = await teamApi.listTeams();
                if (response.success) {
                    this.teams = response.data.teams;
                } else {
                    this.error = response.error;
                }
            } catch (error) {
                // /teams only fetches signed in, so a 401 is a session the
                // API no longer accepts. API Gateway's 401 has no error body,
                // which would leave axios's "Request failed with status code 401".
                this.error = isAxiosError(error) && error.response?.status === 401
                    ? SESSION_EXPIRED_MESSAGE
                    : getApiErrorMessage(error, "Couldn't load your teams.");
                console.error("Error fetching teams:", error);
            } finally {
                this.loading = false;
            }
        },

        async save(payload: SaveTeamPayload) {
            const response = await teamApi.createTeam(payload);
            if (!response.success) {
                throw new Error(response.error);
            }
            return response.data;
        },

        async update(payload: UpdateTeamPayload) {
            const response = await teamApi.updateTeam(payload);
            if (!response.success) {
                throw new Error(response.error);
            }
            return response.data;
        },

        async remove(teamUUID: string) {
            const response = await teamApi.deleteTeam(teamUUID);
            if (!response.success) {
                throw new Error(response.error);
            }
            this.teams = this.teams.filter((t) => t.teamUUID !== teamUUID);
        },

        async publish(payload: PublishTeamPayload) {
            const response = await teamApi.publish(payload);
            if (!response.success) {
                throw new Error(response.error);
            }
            // Keep /teams' badges honest without a refetch.
            const { teamUUID, public: isPublic, cardUrl } = response.data;
            this.teams = this.teams.map((t) =>
                t.teamUUID === teamUUID ? { ...t, public: isPublic, cardUrl } : t,
            );
            return response.data;
        },
    },
});
