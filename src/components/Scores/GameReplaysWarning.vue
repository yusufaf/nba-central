<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
    showReplayConfirm: boolean;
}>();

const emit = defineEmits(["update:showReplayConfirm"]);

const localShowReplayConfirm = computed({
    get() {
        return props.showReplayConfirm;
    },
    set(value) {
        emit("update:showReplayConfirm", value);
    },
});

const shortDateString = new Date().toLocaleDateString("en-us", {
    year: "numeric",
    month: "short",
    day: "numeric",
});

const navigateToReplays = () => {
    const search = encodeURI(shortDateString);
    const fullGameReplaysLink = `https://watchreplay.net/?s=${search}`;
    window.open(fullGameReplaysLink, "_blank");
};
</script>

<template>
    <q-dialog v-model="localShowReplayConfirm">
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
