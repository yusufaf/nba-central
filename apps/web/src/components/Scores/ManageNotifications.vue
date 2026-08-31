<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* 2-Way Bound Props */
const notificationsMenuOpen = defineModel<boolean>("notificationsMenuOpen");
</script>

<template>
    <Dialog v-model:open="notificationsMenuOpen">
        <DialogContent class="notifications-dialog">
            <DialogHeader>
                <DialogTitle class="pr-10">Manage Notifications</DialogTitle>
            </DialogHeader>
            <div class="content-area">
                <p class="description-text">
                    Configure your notification preferences for game alerts and team updates.
                </p>
                <div class="coming-soon-badge">
                    <span class="badge-text">Coming Soon</span>
                    <p class="badge-description">
                        Team-specific notifications and real-time game alerts
                    </p>
                </div>
                <!-- Favorited Teams: -->
                <!-- <template v-for="n in Array(5)" :key="n">
                    <div class="flex items-center justify-between">
                        <Label>Team notification</Label>
                        <Switch />
                    </div>
                </template> -->
            </div>
            <DialogFooter>
                <Button @click="notificationsMenuOpen = false">
                    Close
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
.content-area {
    padding: 1.5rem 0;
}

.description-text {
    font-size: 1.0625rem;
    font-weight: 400;
    color: hsl(var(--foreground) / 0.8);
    line-height: 1.65;
    margin-bottom: 1.5rem;
}

.coming-soon-badge {
    background-color: hsl(var(--warning) / 0.1);
    background-image: linear-gradient(to bottom right, hsl(var(--warning) / 0.14), hsl(var(--warning) / 0.08));
    border: 0.125rem solid hsl(var(--warning) / 0.35);
    border-radius: 0.875rem;
    padding: 1.5rem 1.75rem;
    box-shadow: 0 0.25rem 0.75rem hsl(var(--shadow-color) / 0.3);
}

.badge-text {
    display: inline-block;
    font-size: 0.875rem;
    font-weight: 800;
    color: hsl(var(--warning));
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.625rem;
}

.badge-description {
    font-size: 0.9375rem;
    color: hsl(var(--foreground) / 0.75);
    margin: 0;
    line-height: 1.6;
}

</style>
