<script setup lang="ts">
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import CustomSwitch from "./CustomSwitch.vue";
import { MoreVertical } from "lucide-vue-next";

interface Props {
    hideScores: boolean;
    useShortNames: boolean;
    hideFinishedGames: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    'update:hideScores': [value: boolean];
    'update:useShortNames': [value: boolean];
    'update:hideFinishedGames': [value: boolean];
}>();

const handleHideScoresChange = (value: boolean) => {
    emit('update:hideScores', value);
};

const handleUseShortNamesChange = (value: boolean) => {
    emit('update:useShortNames', value);
};

const handleHideFinishedGamesChange = (value: boolean) => {
    emit('update:hideFinishedGames', value);
};
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" title="More">
                <MoreVertical class="h-5 w-5" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="options-dropdown">
            <div class="options-item">
                <div class="flex items-center justify-between w-full gap-4">
                    <Label for="hide-scores" class="cursor-pointer option-label">Hide Scores</Label>
                    <CustomSwitch
                        id="hide-scores"
                        :checked="props.hideScores"
                        @update:checked="handleHideScoresChange"
                    />
                </div>
            </div>
            <div class="options-item">
                <div class="flex items-center justify-between w-full gap-4">
                    <Label for="hide-finished" class="cursor-pointer option-label">Hide Finished Games</Label>
                    <CustomSwitch
                        id="hide-finished"
                        :checked="props.hideFinishedGames"
                        @update:checked="handleHideFinishedGamesChange"
                    />
                </div>
            </div>
            <div class="options-item">
                <div class="flex items-center justify-between w-full gap-4">
                    <Label for="short-names" class="cursor-pointer option-label">Use Short Names</Label>
                    <CustomSwitch
                        id="short-names"
                        :checked="props.useShortNames"
                        @update:checked="handleUseShortNamesChange"
                    />
                </div>
            </div>
            <DropdownMenuSeparator />
        </DropdownMenuContent>
    </DropdownMenu>
</template>
