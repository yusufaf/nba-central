<!-- <script setup lang="ts">
import { ref, computed } from 'vue'

</script>


<template>
    <q-drawer class="drawer" v-model="showDrawer" :width="300" bordered elevated overlay dark side="right">
        <div class="drawer-header">
            <h6 class="drawer-title">Add Player</h6>
            <q-btn @click="showDrawer = false" round icon="close" class="drawer-close" />
        </div>
        <q-input outlined v-model="search" placeholder="Search for a player" type="search" dark>
            <template v-slot:append>
                <q-icon name="search" />
            </template>
        </q-input>
        <q-linear-progress v-if="searchLoading" indeterminate color="primary" />
        <q-list>
            <template v-for="(player, index) in searchListResults" :key="player.id">
                <q-item clickable v-ripple>
                    <q-item-section class="player-item">
                        <div>
                            <div>{{ player.fullName }}</div>
                            <div>{{ player.heightAndWeight }}</div>
                            <div>{{ player.team.full_name }}</div>
                        </div>
                        <div class="player-position">
                            {{ player.position }}
                        </div>
                    </q-item-section>
                </q-item>
                <q-separator />
            </template>
        </q-list>
    </q-drawer>
</template>

<style>

</style>



 -->
