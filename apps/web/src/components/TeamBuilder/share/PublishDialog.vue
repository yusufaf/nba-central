<script setup lang="ts">
import { ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CardStyle } from '@/models/api';

const props = defineProps<{
    // The team's stored choice, picked whenever the dialog opens.
    cardStyle: CardStyle;
    mode: 'publish' | 'change';
}>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [style: CardStyle] }>();

const OPTIONS: { value: CardStyle; label: string; hint: string }[] = [
    { value: '2d', label: '2D card', hint: 'Your logo, court and starting five' },
    { value: '3d', label: '3D team photo', hint: 'Your starting five, coach and GM on your court' },
];

const choice = ref<CardStyle>(props.cardStyle);
watch(open, (isOpen) => {
    if (isOpen) choice.value = props.cardStyle;
});

// A single ToggleGroup emits '' when its pressed item is clicked again; a
// style must stay picked.
const pick = (value: unknown) => {
    if (value === '2d' || value === '3d') choice.value = value;
};

const confirm = () => {
    open.value = false;
    emit('confirm', choice.value);
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent size="sm">
            <DialogHeader>
                <DialogTitle>{{ mode === 'publish' ? 'Publish team' : 'Change link preview' }}</DialogTitle>
                <DialogDescription>
                    <template v-if="mode === 'publish'">Anyone with the link can see it. It shows your username. </template>
                    Pick the picture shown when the link is shared.
                </DialogDescription>
            </DialogHeader>

            <ToggleGroup
                :model-value="choice"
                type="single"
                variant="outline"
                class="grid grid-cols-1 gap-2"
                aria-label="Link preview"
                @update:model-value="pick"
            >
                <ToggleGroupItem
                    v-for="option in OPTIONS"
                    :key="option.value"
                    :value="option.value"
                    :data-testid="`card-style-${option.value}`"
                    class="h-auto flex-col items-start gap-1 whitespace-normal p-4 text-left"
                >
                    <span class="font-semibold">{{ option.label }}</span>
                    <span class="text-sm font-normal text-muted-foreground">{{ option.hint }}</span>
                </ToggleGroupItem>
            </ToggleGroup>

            <DialogFooter>
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button data-testid="publish-confirm" @click="confirm">
                    {{ mode === 'publish' ? 'Publish' : 'Update preview' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
