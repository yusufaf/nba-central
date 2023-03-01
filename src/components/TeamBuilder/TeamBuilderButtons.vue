<script setup lang="ts">
import { ref, watch } from 'vue'
import {
    VIEW_OPTIONS,
    DRAWER_OPTIONS
} from "@/constants/constants";
const emit = defineEmits(['reset', 'saveTeam', 'viewChange', 'drawerSideChange', 'headerExpanded'])

const showConfirm = ref<boolean>(false);
const selectedView = ref<string>("Default");
const drawerSide = ref<string>("right");
const headerExpanded = ref<boolean>(false);

/* Watchers */
watch(selectedView, (newSelectedView) => {
    emit('viewChange', newSelectedView);
})

watch(drawerSide, (newDrawerSide) => {
    emit('drawerSideChange', newDrawerSide);
})

const resetClick = (): void => {
    showConfirm.value = !showConfirm.value;
}

const resetConfirm = (): void => {
    emit('reset');
}

const saveClick = (): void => {
    emit('saveTeam');
}

const expandClick = (): void => {
    headerExpanded.value = !headerExpanded.value;
    emit('headerExpanded', headerExpanded.value);
}

</script>

<template>
    <div class="team-builder-buttons">
        <q-btn round icon="more_vert" title="More" />
        <q-btn class="expand-btn" @click="expandClick" round :icon="headerExpanded ? 'expand_less' : 'expand_more'" title="More" />
        <q-btn round icon="more_vert" title="More">
            <q-menu dark transition-show="jump-down" transition-hide="jump-up">
                <q-list dark>
                    <q-item>
                        <q-item-section side>
                            <q-item-label>Drawer Side</q-item-label>
                        </q-item-section>
                        <q-item-section>
                            <q-btn-toggle v-model="drawerSide" toggle-color="primary" :options="DRAWER_OPTIONS" />
                        </q-item-section>
                    </q-item>
                </q-list>
            </q-menu>
        </q-btn>
        <q-btn-toggle v-model="selectedView" toggle-color="primary" :options="VIEW_OPTIONS" />
        <q-btn @click="resetClick" round color="black" icon="share" title="Share" />
        <q-btn @click="resetClick" round color="black" icon="refresh" title="Reset" />
        <q-btn @click="saveClick" round color="black" icon="save" title="Save" />
    </div>
    <q-dialog v-model="showConfirm">
        <q-card dark>
            <q-card-section class="row items-center">
                <div>Are you sure you want to reset your whole team?</div>
            </q-card-section>
            <q-card-actions align="right">
                <q-btn flat label="Cancel" color="primary" v-close-popup />
                <q-btn @click="resetConfirm" label="Confirm" color="primary" v-close-popup />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<style scoped>
.team-builder-buttons {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-left: auto;
}
</style>
