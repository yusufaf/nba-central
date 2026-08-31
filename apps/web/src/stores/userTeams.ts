import { defineStore } from "pinia";
import { teamApi } from "@/network/api";
import type {
    SaveTeamPayload,
    UpdateTeamPayload,
    TeamSummary,
} from "@/models/api";

interface UserTeamsState {
    teams: TeamSummary[];
    loading: boolean;
    error: string | null;
}

// Separate from `stores/teams.ts`, which owns the 30 NBA franchises' logos
// and is fetched by every visitor, signed in or not. This store is the
// signed-in user's own saved teams - a different "teams" entirely.
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
                this.error =
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch teams";
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
    },
});
