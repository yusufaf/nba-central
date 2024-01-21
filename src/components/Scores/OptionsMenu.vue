<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
    hideScores: boolean;
    useShortNames: boolean;
    hideFinishedGames: boolean;
}>();

const emit = defineEmits([
    "update:hideScores",
    "update:useShortNames",
    "update:hideFinishedGames",
]);

const localHideScores = computed({
    get() {
        return props.hideScores;
    },
    set(value) {
        emit("update:hideScores", value);
    },
});

const localUseShortNames = computed({
    get() {
        return props.useShortNames;
    },
    set(value) {
        emit("update:useShortNames", value);
    },
});

const localHideFinishedGames = computed({
    get() {
        return props.hideFinishedGames;
    },
    set(value) {
        emit("update:hideFinishedGames", value);
    },
});
</script>

<template>
    <q-btn round icon="more_vert" title="More">
        <q-menu dark transition-show="jump-down" transition-hide="jump-up">
            <q-list>
                <q-item>
                    <q-item-section>
                        <q-toggle
                            v-model="localHideScores"
                            label="Hide Scores"
                        />
                    </q-item-section>
                </q-item>
                <q-item>
                    <q-item-section>
                        <q-toggle
                            v-model="localHideFinishedGames"
                            label="Hide Finished Games"
                        />
                    </q-item-section>
                </q-item>
                <q-item>
                    <q-item-section>
                        <q-toggle
                            v-model="localUseShortNames"
                            label="Use Short Names"
                        />
                    </q-item-section>
                </q-item>
                <q-separator />
            </q-list>
        </q-menu>
    </q-btn>
</template>
