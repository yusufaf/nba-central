<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import {
    VIEW_OPTIONS,
    DRAWER_OPTIONS,
    ESPN_TEAM_URL,
} from "@/constants/constants";
import axios from "axios";
import TeamCustomizationDialog from "./TeamCustomizationDialog.vue";

const emit = defineEmits(["reset", "saveTeam"]);

/* 2-Way Bound Props */
const headerExpanded = defineModel<boolean>("headerExpanded");
const teamName = defineModel<string>("teamName");
const teamDescription = defineModel<string>("teamDescription");
const teamCity = defineModel<string>("teamCity");
const teamCountry = defineModel<string>("teamCountry");
const selectedView = defineModel<string>("selectedView");
const teamLogo = defineModel<string>("teamLogo");
const drawerSide = defineModel<string>("drawerSide");

const showConfirm = ref<boolean>(false);
const showTeamCustomizationDialog = ref<boolean>(false);

const nbaTeamLogos = ref<any[]>([]);

/* Watchers */

const resetClick = () => {
    showConfirm.value = !showConfirm.value;
};

const resetConfirm = () => {
    emit("reset");
};

const saveClick = () => {
    emit("saveTeam");
};

const expandClick = () => {
    headerExpanded.value = !headerExpanded.value;
};

const toggleCustomizationDialog = () => {
    showTeamCustomizationDialog.value = !showTeamCustomizationDialog.value;
};

const fetchAllTeamLogos = async () => {
    const tempLogos: any[] = [];
    for (let i = 1; i < 31; i++) {
        const url = `${ESPN_TEAM_URL}${i}`;
        const response = await axios.get(url);
        const { team } = response.data;

        const logos = team.logos;

        /* Take the first logo for now */
        const logo = logos[0];
        tempLogos.push(logo);
    }

    /* Sort the logos alphabetically */
    nbaTeamLogos.value = tempLogos.sort((a, b) => {
        const hrefSplitA = a.href.split("/");
        const teamAbbrA = a.href.split("/")[hrefSplitA.length - 1];

        const hrefSplitB = b.href.split("/");
        const teamAbbrB = b.href.split("/")[hrefSplitB.length - 1];

        return teamAbbrA.localeCompare(teamAbbrB);
    });
};

onMounted(() => {
    fetchAllTeamLogos();
});
</script>

<template>
    <div class="header" :class="{ expanded: headerExpanded }">
        <div class="header-top">
            <div class="title-input-container">
                <q-input
                    class="title-input"
                    v-model="teamName"
                    label="Team Name"
                    stack-label
                    dark
                />
                <q-btn
                    @click="toggleCustomizationDialog"
                    round
                    icon="edit"
                    title="Open customization dialog"
                />
            </div>

            <div class="hidden">Hidden</div>
            <!-- TODO: Make the score animated so that when its value changes there's some cool animation  -->
            <div class="score">Score: N/A</div>
            <div class="team-builder-buttons">
                <q-btn
                    class="expand-btn"
                    @click="expandClick"
                    round
                    :icon="headerExpanded ? 'expand_less' : 'expand_more'"
                    title="More"
                />
                <q-btn round icon="more_vert" title="More">
                    <q-menu
                        dark
                        transition-show="jump-down"
                        transition-hide="jump-up"
                    >
                        <q-list dark>
                            <q-item>
                                <q-item-section side>
                                    <q-item-label>Drawer Side</q-item-label>
                                </q-item-section>
                                <q-item-section>
                                    <q-btn-toggle
                                        v-model="drawerSide"
                                        toggle-color="primary"
                                        :options="DRAWER_OPTIONS"
                                    />
                                </q-item-section>
                            </q-item>
                        </q-list>
                    </q-menu>
                </q-btn>
                <q-btn-toggle
                    v-model="selectedView"
                    toggle-color="primary"
                    :options="VIEW_OPTIONS"
                />
                <q-btn
                    @click="resetClick"
                    round
                    color="black"
                    icon="share"
                    title="Share"
                />
                <q-btn
                    @click="resetClick"
                    round
                    color="black"
                    icon="refresh"
                    title="Reset"
                />
                <q-btn
                    @click="saveClick"
                    round
                    color="black"
                    icon="save"
                    title="Save"
                />
            </div>
            <q-dialog v-model="showConfirm">
                <q-card dark>
                    <q-card-section class="row items-center">
                        <div>
                            Are you sure you want to reset your whole team?
                        </div>
                    </q-card-section>
                    <q-card-actions align="right">
                        <q-btn
                            flat
                            label="Cancel"
                            color="primary"
                            v-close-popup
                        />
                        <q-btn
                            @click="resetConfirm"
                            label="Confirm"
                            color="primary"
                            v-close-popup
                        />
                    </q-card-actions>
                </q-card>
            </q-dialog>
        </div>
    </div>
    <TeamCustomizationDialog
        :nbaTeamLogos
        v-model:showTeamCustomizationDialog="showTeamCustomizationDialog"
        v-model:teamDescription="teamDescription"
        v-model:teamCity="teamCity"
        v-model:teamCountry="teamCountry"
        v-model:teamLogo="teamLogo"
    />
</template>

<style scoped>
.header {
    display: flex;
    flex-direction: column;
    border-bottom: 0.125rem solid var(--vt-c-divider-dark-1);
}

.header-top {
    display: flex;
    flex-direction: row;
    align-items: center;
}

.header.expanded {
    height: 10rem;
}

.team-builder-buttons {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-left: auto;
}

.title-input-container {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.title-input {
    margin-left: 2rem;
    width: 20rem;
}

.desc-input {
    resize: none;
}

.hidden {
    visibility: hidden;
}

.score {
    display: flex;
    font-size: 2rem;
    font-weight: 600;
    margin-left: auto;
    /* justify-self: center; */
}
</style>
