<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import PageTitle from "@/components/PageTitle.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirm-dialog/ConfirmDialog.vue";
import { Shield, Plus, Users, Trash2 } from "lucide-vue-next";
import { useUserTeamsStore } from "@/stores/userTeams";
import type { TeamSummary } from "@/models/api";

const router = useRouter();
const userTeamsStore = useUserTeamsStore();

const teamToDelete = ref<TeamSummary | null>(null);
const showDeleteDialog = ref(false);
const deleting = ref(false);

const formatUpdatedAt = (updatedAt: number) =>
    new Date(updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

const openTeam = (teamUUID: string) => {
    router.push({ path: "/teambuilder", query: { team: teamUUID } });
};

const confirmDelete = (team: TeamSummary) => {
    teamToDelete.value = team;
    showDeleteDialog.value = true;
};

const handleDelete = async () => {
    if (!teamToDelete.value) return;

    deleting.value = true;
    try {
        await userTeamsStore.remove(teamToDelete.value.teamUUID);
        toast.success(`Deleted ${teamToDelete.value.title}`);
        showDeleteDialog.value = false;
        teamToDelete.value = null;
    } catch (err) {
        toast.error(
            err instanceof Error ? err.message : "Failed to delete team",
        );
    } finally {
        deleting.value = false;
    }
};

onMounted(() => {
    userTeamsStore.fetch();
});
</script>

<template>
    <main class="teams-page">
        <PageTitle />
        <div class="teams-container">
            <div v-if="userTeamsStore.loading" class="status-state">
                <p class="status-copy">Loading your teams...</p>
            </div>

            <div v-else-if="userTeamsStore.error" class="status-state">
                <p class="status-copy error-copy">{{ userTeamsStore.error }}</p>
                <Button variant="outline" @click="userTeamsStore.fetch()">
                    Try again
                </Button>
            </div>

            <div v-else-if="userTeamsStore.teams.length === 0" class="empty-state">
                <div class="empty-state-icon">
                    <Shield class="h-10 w-10 text-primary" />
                </div>
                <p class="empty-state-title">No teams yet</p>
                <p class="empty-state-copy">
                    You haven't created any teams. Head to Team Builder to put one together.
                </p>
                <Button @click="router.push('/teambuilder')">
                    <Plus class="h-4 w-4 mr-2" />
                    Build a Team
                </Button>
            </div>

            <div v-else class="teams-grid">
                <Card
                    v-for="team in userTeamsStore.teams"
                    :key="team.teamUUID"
                    class="team-card"
                >
                    <CardHeader>
                        <CardTitle class="team-card-title">{{ team.title }}</CardTitle>
                    </CardHeader>
                    <CardContent class="team-card-content">
                        <p v-if="team.description" class="team-description">
                            {{ team.description }}
                        </p>
                        <div class="team-meta">
                            <Badge variant="secondary" class="player-count-badge">
                                <Users class="h-3 w-3 mr-1" />
                                {{ team.playerCount ?? 0 }} {{ team.playerCount === 1 ? 'player' : 'players' }}
                            </Badge>
                            <span class="updated-at">
                                Updated {{ formatUpdatedAt(team.updatedAt) }}
                            </span>
                        </div>
                        <div class="team-actions">
                            <Button
                                class="open-button"
                                @click="openTeam(team.teamUUID)"
                            >
                                Open
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Delete team"
                                @click="confirmDelete(team)"
                            >
                                <Trash2 class="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>

        <ConfirmDialog
            v-model:open="showDeleteDialog"
            title="Delete team?"
            :description="`Are you sure you want to delete ${teamToDelete?.title}? This action cannot be undone.`"
            confirm-text="Delete"
            variant="destructive"
            :loading="deleting"
            @confirm="handleDelete"
        />
    </main>
</template>

<style scoped>
.teams-page {
    display: grid;
    justify-items: center;
    padding: 0 4rem;
}

.teams-container {
    width: 100%;
    max-width: 75rem;
}

.status-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 1.5rem;
    text-align: center;
}

.status-copy {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
}

.error-copy {
    color: hsl(var(--destructive));
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 4rem 1.5rem;
}

.empty-state-icon {
    background-color: hsl(var(--primary) / 0.1);
    border-radius: 9999px;
    padding: 1.25rem;
    margin-bottom: 1rem;
}

.empty-state-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: hsl(var(--foreground));
}

.empty-state-copy {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    margin: 0.25rem 0 1.5rem;
    max-width: 24rem;
}

.teams-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
    padding: 1rem 0 3rem;
}

@media (min-width: 640px) {
    .teams-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (min-width: 1024px) {
    .teams-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

.team-card {
    border-radius: 0.5rem;
    border: 0.125rem solid;
    border-color: hsl(var(--primary) / 0.5);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.team-card:hover {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0.5rem hsl(var(--primary) / 0.3);
}

.team-card-title {
    font-size: 1.125rem;
}

.team-card-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.team-description {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.team-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.player-count-badge {
    display: inline-flex;
    align-items: center;
}

.updated-at {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
}

.team-actions {
    display: flex;
    gap: 0.5rem;
}

.open-button {
    flex: 1;
}
</style>
