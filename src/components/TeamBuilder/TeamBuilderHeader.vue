<script setup lang="ts">
import { ref, watch } from "vue";
import { VIEW_OPTIONS, DRAWER_OPTIONS } from "@/constants/constants";

const props = defineProps<{
  headerExpanded: boolean;
  teamName: string;
  teamDescription: string;
  teamCity: string;
  drawerSide: string;
}>();

const emit = defineEmits([
  "reset",
  "saveTeam",
  "viewChange",
  "drawerSideChange",
  "headerExpanded",
  "teamNameChange",
  "teamDescriptionChange",
  "teamCityChange",
]);

const localTeamName = ref(props.teamName);
const localTeamDescription = ref(props.teamDescription);
const localTeamCity = ref(props.teamCity);
const localDrawerSide = ref(props.drawerSide);

const showConfirm = ref<boolean>(false);
const selectedView = ref<string>("Default");
const headerExpanded = ref<boolean>(false);
const showTeamCustomizationDialog = ref<boolean>(false);

/* Watchers */
watch(() => props.teamName,
  (value) => {
    localTeamName.value = value;
  }
);

watch(
  () => props.teamDescription,
  (value) => {
    localTeamDescription.value = value;
  }
);

watch(
  () => props.teamCity,
  (value) => {
    localTeamCity.value = value;
  }
);

watch(
  () => props.drawerSide,
  (value) => {
    localDrawerSide.value = value;
  }
);

watch(selectedView, (newSelectedView) => {
  emit("viewChange", newSelectedView);
});

watch(localDrawerSide, (newDrawerSide) => {
  emit("drawerSideChange", newDrawerSide);
});

watch(localTeamName, (newTeamName) => {
  emit("teamNameChange", newTeamName);
});

watch(localTeamDescription, (newTeamDescription) => {
  emit("teamDescriptionChange", newTeamDescription);
});

watch(localTeamCity, (newTeamCity) => {
  emit("teamCityChange", newTeamCity);
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
  headerExpanded.value = !headerExpanded.value;
  emit("headerExpanded", headerExpanded.value);
};

const toggleCustomizationDialog = (): void => {
  showTeamCustomizationDialog.value = !showTeamCustomizationDialog.value;
};
</script>

<template>
  <div class="header" :class="{ expanded: headerExpanded }">
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
          :icon="headerExpanded ? 'expand_less' : 'expand_more'"
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
      <div>
        Team Logo
      </div>
      <q-file
        input-class="file-picker"
        dark
        outlined
        v-model="model"
        label="Click to select files or drag into this area"
        stack-label
        accept=".jpg, image/*"
      >
        <template v-slot:prepend>
          <q-icon name="attach_file" />
        </template>
      </q-file>
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
</style>
