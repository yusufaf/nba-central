<script setup lang="ts">
/* 2-Way Bound Props */
const hideScores = defineModel<boolean>("hideScores");
const useShortNames = defineModel<boolean>("useShortNames");
const hideFinishedGames = defineModel<boolean>("hideFinishedGames");
</script>

<template>
    <q-btn round icon="more_vert" title="More">
        <q-menu dark transition-show="jump-down" transition-hide="jump-up">
            <q-list>
                <q-item>
                    <q-item-section>
                        <q-toggle v-model="hideScores" label="Hide Scores" />
                    </q-item-section>
                </q-item>
                <q-item>
                    <q-item-section>
                        <q-toggle
                            v-model="hideFinishedGames"
                            label="Hide Finished Games"
                        />
                    </q-item-section>
                </q-item>
                <q-item>
                    <q-item-section>
                        <q-toggle
                            v-model="useShortNames"
                            label="Use Short Names"
                        />
                    </q-item-section>
                </q-item>
                <q-separator />
            </q-list>
        </q-menu>
    </q-btn>
</template>
