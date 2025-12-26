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
                <Button @click="notificationsMenuOpen = false" class="close-btn">
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
    color: rgb(230, 230, 230);
    line-height: 1.65;
    margin-bottom: 1.5rem;
}

.coming-soon-badge {
    background-color: rgb(45, 35, 20);
    background-image: linear-gradient(to bottom right, rgb(50, 38, 22), rgb(40, 32, 18));
    border: 2px solid rgb(100, 75, 35);
    border-radius: 14px;
    padding: 1.5rem 1.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.badge-text {
    display: inline-block;
    font-size: 0.875rem;
    font-weight: 800;
    color: rgb(255, 180, 50);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 0.625rem;
}

.badge-description {
    font-size: 0.9375rem;
    color: rgb(220, 220, 220);
    margin: 0;
    line-height: 1.6;
}

.close-btn {
    font-weight: 600 !important;
    background-color: hsl(var(--primary)) !important;
    color: rgb(20, 20, 20) !important;
    box-shadow: 0 2px 8px rgba(255, 165, 0, 0.25) !important;
}

.close-btn:hover {
    background-color: hsl(var(--primary) / 0.9) !important;
    box-shadow: 0 4px 12px rgba(255, 165, 0, 0.35) !important;
    transform: translateY(-1px);
}
</style>
