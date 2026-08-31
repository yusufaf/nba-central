<script setup lang="ts">
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/* 2-Way Bound Props */
const showReplayConfirm = defineModel<boolean>("showReplayConfirm");

const navigateToReplays = () => {
    const shortDateString = new Date().toLocaleDateString("en-us", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    const search = encodeURI(shortDateString);
    const fullGameReplaysLink = `https://watchreplay.net/?s=${search}`;
    window.open(fullGameReplaysLink, "_blank");
    showReplayConfirm.value = false;
};
</script>

<template>
    <ConfirmDialog
        v-model:open="showReplayConfirm"
        title="External Website"
        description="This will take you to an external website to access full game replays for today's slate of games. View at your own risk 🙂"
        confirm-text="Continue"
        cancel-text="Cancel"
        @confirm="navigateToReplays"
    />
</template>
