import { defineStore } from "pinia";
import { dataApi, teamApi } from "@/network/api";

interface TeamLogo {
    alt: string;
    height: number;
    href: string;
    lastUpdated: string;
    rel: string[];
    width: number;
}

interface Team {
    abbreviation: string;
    displayName: string;
    logos: TeamLogo[];
}

interface TeamsState {
    teams: Team[];
    loading: boolean;
    error: string | null;
}

export const useTeamsStore = defineStore("teams", {
    state: (): TeamsState => ({
        teams: [],
        loading: false,
        error: null,
    }),

    actions: {
        async fetchTeamLogos() {
            this.loading = true;
            this.error = null;

            try {
                const { teams } = await dataApi.getTeamLogos();
                this.teams = teams;
            } catch (error) {
                this.error =
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch team logos";
                console.error("Error fetching team logos:", error);
            } finally {
                this.loading = false;
            }
        },
    },

    getters: {
        sortedTeams: (state) => {
            return [...state.teams].sort((a, b) =>
                a.abbreviation.localeCompare(b.abbreviation),
            );
        },
        getTeamByAbbreviation: (state) => {
            return (abbreviation: string) =>
                state.teams.find((team) => team.abbreviation === abbreviation);
        },
    },
});
