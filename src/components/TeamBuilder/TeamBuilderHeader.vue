<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import {
  VIEW_OPTIONS,
  DRAWER_OPTIONS,
  ESPN_TEAM_URL,
} from "@/constants/constants";
import type { DrawerSide } from "@/constants/constants";
import axios from "axios";

const props = defineProps<{
  headerExpanded: boolean;
  teamName: string;
  teamDescription: string;
  teamCity: string;
  teamCountry: string;
  drawerSide: DrawerSide;
  selectedView: string;
}>();

const emit = defineEmits([
  "reset",
  "saveTeam",
  "update:headerExpanded",
  "update:teamName",
  "update:teamDescription",
  "update:teamCity",
  "update:drawerSide",
  "update:selectedView",
]);

const localTeamName = ref(props.teamName);
const localTeamDescription = ref(props.teamDescription);
const localTeamCity = ref(props.teamCity);
const localTeamCountry = ref(props.teamCountry);

const localTeamLogo = ref<string>("");

const localDrawerSide = ref<DrawerSide>(props.drawerSide);
const localSelectedView = ref<string>(props.selectedView);
const localHeaderExpanded = ref<boolean>(false);

const showConfirm = ref<boolean>(false);
const showTeamCustomizationDialog = ref<boolean>(false);
const selectedFile = ref<null>(null);

const nbaTeamLogos = ref<any[]>([]);

/* Watchers */
watch(localTeamName, (newTeamName) => {
  emit("update:teamName", newTeamName);
});

watch(localTeamDescription, (newTeamDescription) => {
  emit("update:teamDescription", newTeamDescription);
});

watch(localTeamCity, (newTeamCity) => {
  emit("update:teamCity", newTeamCity);
});

watch(localDrawerSide, (newDrawerSide) => {
  emit("update:drawerSide", newDrawerSide);
});

watch(localSelectedView, (newSelectedView) => {
  emit("update:selectedView", newSelectedView);
});

watch(localHeaderExpanded, (newHeaderExpanded) => {
  emit("update:headerExpanded", newHeaderExpanded);
});

const resetClick = (): void => {
  showConfirm.value = !showConfirm.value;
};

const resetConfirm = (): void => {
  emit("reset");
};

const saveClick = (): void => {
  emit("saveTeam");
};

const expandClick = (): void => {
  localHeaderExpanded.value = !localHeaderExpanded.value;
};

const toggleCustomizationDialog = (): void => {
  showTeamCustomizationDialog.value = !showTeamCustomizationDialog.value;
};

const fetchAllTeamLogos = async () => {
  for (let i = 1; i < 31; i++) {
    const url = `${ESPN_TEAM_URL}${i}`;
    const response = await axios.get(url);
    const {team} = response.data;

    const logos = team.logos;

    /* Take the first logo for now */
    const logo = logos[0];
    nbaTeamLogos.value = nbaTeamLogos.value.concat(logo);
  }
  nbaTeamLogos.value = nbaTeamLogos.value.sort((a, b) => {
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
  <div class="header" :class="{ expanded: localHeaderExpanded }">
    <div class="header-top">
      <div class="title-input-container">
        <q-input
          class="title-input"
          v-model="localTeamName"
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
          :icon="localHeaderExpanded ? 'expand_less' : 'expand_more'"
          title="More"
        />
        <q-btn round icon="more_vert" title="More">
          <q-menu dark transition-show="jump-down" transition-hide="jump-up">
            <q-list dark>
              <q-item>
                <q-item-section side>
                  <q-item-label>Drawer Side</q-item-label>
                </q-item-section>
                <q-item-section>
                  <q-btn-toggle
                    v-model="localDrawerSide"
                    toggle-color="primary"
                    :options="DRAWER_OPTIONS"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-btn-toggle
          v-model="localSelectedView"
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
            <div>Are you sure you want to reset your whole team?</div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup />
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
  <q-dialog v-model="showTeamCustomizationDialog">
    <div class="customization-dialog">
      <div class="customization-header">
        <div class="customization-title">Team Customization</div>
        <q-btn
          @click="toggleCustomizationDialog"
          round
          icon="close"
          title="Close customization dialog"
        />
      </div>
      <q-input
        v-model="localTeamDescription"
        outlined
        label="Team Description"
        stack-label
        dark
        type="textarea"
      />
      <q-input v-model="localTeamCity" label="City" dark>
        <template v-slot:prepend>
          <q-icon name="place" />
        </template>
      </q-input>
      <q-input v-model="localTeamCountry" label="Country" dark>
        <template v-slot:prepend>
          <q-icon name="flag" />
        </template>
      </q-input>
      <div>Team Logo</div>
      <q-file
        input-class="file-picker"
        dark
        outlined
        v-model="selectedFile"
        label="Click to select files or drag into this area"
        stack-label
        accept=".jpg, image/*"
      >
        <template v-slot:prepend>
          <q-icon name="attach_file" />
        </template>
      </q-file>
      <div>or select an existing team's logo:</div>
      <div class="team-logos">
        <q-img
          v-for="logo in nbaTeamLogos"
          :key="logo.href"
          :src="logo.href"

          class="team-logo"
          :class="{ selected: logo.href === localTeamLogo }"
        />
      </div>
    </div>
  </q-dialog>
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
  /* width: 15%; */
  margin-left: 2rem;
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

.customization-dialog {
  background: var(--vt-c-black-soft);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 40rem;
  width: 40rem;
  padding: 1rem;
}

.customization-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.customization-title {
  font-size: 1.25rem;
  font-weight: 600;
}

.file-picker {
  height: 20rem;
}

.team-logo {
  border: 0.125rem solid var(--vt-c-divider-dark-1);
  border-radius: 0.5rem;
  cursor: pointer;
  height: 6.25rem;
  width: 6.25rem;
}

.team-logo:hover {
  border: 0.125rem solid var(--q-primary);
}

</style>
