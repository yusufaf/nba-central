<script setup lang="ts">
import { ref } from 'vue'

const showConfirm = ref(false);
const selectedView = ref("Default");

const resetClick = () => {
    showConfirm.value = !showConfirm.value;
}

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
        <q-btn round color="black" icon="save" title="Save" />
    </div>
    <q-dialog v-model="showConfirm">
        <q-card dark>
            <q-card-section class="row items-center">
                <div>You are currently not connected to any network.</div>
            </q-card-section>
            <q-card-actions align="right">
                <q-btn flat label="Cancel" color="primary" v-close-popup />
                <q-btn flat label="Confirm" color="primary" v-close-popup />
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
