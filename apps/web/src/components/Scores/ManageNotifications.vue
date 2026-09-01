<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGameNotifications } from "@/composables/useGameNotifications";
import { X } from "lucide-vue-next";

/* 2-Way Bound Props */
const notificationsMenuOpen = defineModel<boolean>("notificationsMenuOpen");

const {
    followedGames,
    notificationPermission,
    notificationsSupported,
    requestPermission,
    unfollowGame,
} = useGameNotifications();

const followedGamesList = computed(() => Object.values(followedGames.value));

const permissionBadge = computed(() => {
    switch (notificationPermission.value) {
        case "granted":
            return { label: "Enabled", variant: "default" as const };
        case "denied":
            return { label: "Blocked", variant: "destructive" as const };
        default:
            return { label: "Not enabled", variant: "secondary" as const };
    }
});
</script>

<template>
    <Dialog v-model:open="notificationsMenuOpen">
        <DialogContent class="notifications-dialog">
            <DialogHeader>
                <DialogTitle class="pr-10">Manage Notifications</DialogTitle>
            </DialogHeader>
            <div class="content-area">
                <p class="description-text">
                    Get a browser notification when the score changes for games
                    you're following. Click the bell on a game's scorecard to
                    follow it.
                </p>

                <div class="permission-row">
                    <div class="permission-status">
                        <span>Browser notifications:</span>
                        <Badge :variant="permissionBadge.variant">{{ permissionBadge.label }}</Badge>
                    </div>
                    <Button
                        v-if="notificationPermission === 'default'"
                        size="sm"
                        @click="requestPermission"
                    >
                        Enable Notifications
                    </Button>
                </div>
                <p v-if="!notificationsSupported" class="unsupported-text">
                    This browser doesn't support notifications.
                </p>
                <p v-else-if="notificationPermission === 'denied'" class="unsupported-text">
                    Notifications are blocked. Update your browser's site
                    permissions to allow them.
                </p>

                <div class="followed-games">
                    <template v-if="followedGamesList.length">
                        <div
                            v-for="game in followedGamesList"
                            :key="game.uid"
                            class="followed-game-row"
                        >
                            <span>{{ game.label }}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                title="Stop notifying me about this game"
                                @click="unfollowGame(game.uid)"
                            >
                                <X class="h-4 w-4" />
                            </Button>
                        </div>
                    </template>
                    <p v-else class="empty-text">
                        You're not following any games yet.
                    </p>
                </div>
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

.permission-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
}

.permission-status {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-weight: 500;
}

.unsupported-text {
    font-size: 0.875rem;
    color: hsl(var(--foreground) / 0.65);
    margin-bottom: 1rem;
}

.followed-games {
    border-top: 0.0625rem solid hsl(var(--border));
    padding-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.followed-game-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.empty-text {
    font-size: 0.875rem;
    color: hsl(var(--foreground) / 0.65);
}
</style>
