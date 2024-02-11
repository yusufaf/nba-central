<script setup lang="ts">
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
};
</script>

<template>
    <q-dialog v-model="showReplayConfirm">
        <q-card dark>
            <q-card-section class="row items-center">
                <div>
                    This will take you to an external website to access full
                    game replays for today's slate of games, view at your own
                    risk 🙂
                </div>
            </q-card-section>
            <q-card-actions align="right">
                <q-btn flat label="Cancel" color="primary" v-close-popup />
                <q-btn
                    @click="navigateToReplays"
                    flat
                    label="Confirm"
                    color="primary"
                    v-close-popup
                />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
