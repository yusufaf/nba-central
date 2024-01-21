<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
    notificationsMenuOpen: boolean;
}>();

const emit = defineEmits(["update:notificationsMenuOpen"]);

const localNotificationsMenuOpen = computed({
    get() {
        return props.notificationsMenuOpen;
    },
    set(value) {
        emit("update:notificationsMenuOpen", value);
    },
});
</script>

<template>
    <q-dialog v-model="localNotificationsMenuOpen">
        <q-card dark>
            <q-card-section class="row items-center">
                test
                <!-- <q-select 
          outlined
          label="Sort"
          clearable
          dark
          multiple
        /> -->

                <!-- Favorited Teams: -->
                <q-list dark bordered>
                    <!-- <template v-for="n in Array(5)" :key="n">
                            <q-item>
                                <q-item-section>
                                    <q-toggle
                                        v-model="hideScores"
                                        label="Hide Scores"
                                    />
                                </q-item-section>
                            </q-item>
                            <q-separator dark />
                        </template> -->
                </q-list>
            </q-card-section>
            <q-card-actions align="right">
                <q-btn flat label="Close" color="primary" v-close-popup />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>
