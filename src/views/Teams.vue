<script setup lang="ts">
import { useRouter } from "vue-router";
import PageTitle from "@/components/PageTitle.vue";
import { Button } from "@/components/ui/button";
import { Shield, Plus } from "lucide-vue-next";

const router = useRouter();
</script>

<template>
    <main class="teams-page">
        <PageTitle />
        <div class="teams-container">
            <div class="empty-state">
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
        </div>
    </main>
</template>

<style scoped>
.teams-page {
    display: grid;
    justify-items: center;
    padding: 0 4rem;
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
</style>
