<script setup lang="ts">
import { ref, watch } from 'vue'

const emit = defineEmits(['reset', 'saveTeam', 'viewChange'])

const showConfirm = ref<boolean>(false);
const selectedView = ref<string>("Default");

watch(selectedView, (newSelectedView) => {
    emit('viewChange', newSelectedView);
})

const resetClick = () => {
    showConfirm.value = !showConfirm.value;
}


const resetConfirm = () => {
    emit('reset');
}

const saveClick = () => {
    emit('saveTeam');
}

/* TODO: Reset can do the emit/dispatch logic to the TeamBuilder */

</script>

<template>
    <div class="team-builder-buttons">
        <q-btn-toggle 
            v-model="selectedView" 
            toggle-color="primary" 
            :options="[
            { label: 'Default', value: 'Default' },
            { label: 'List', value: 'List' }
        ]" />
        <!-- Reset Button: Pops up a confirm dialog -->
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

.container {}
</style>
