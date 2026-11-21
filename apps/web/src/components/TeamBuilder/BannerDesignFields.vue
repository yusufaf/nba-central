<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-vue-next';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import ColourField from './creator/ColourField.vue';
import {
    BANNER_KINDS,
    BANNER_SUBTITLE_MAX,
    BANNER_TITLE_MAX,
    BANNERS_MAX,
    type BannerKindId,
    type VenueBanner,
    type VenueDesign,
} from '@/constants/venue';
import {
    BANNER_KIND_LABELS,
    BANNER_SWATCHES,
    addBanner,
    moveBanner,
    removeBanner,
    setBanner,
} from '@/utils/venue';

// The Banners tab's settings (#297): up to eight rafters banners, one
// accordion panel each so eight stay short at 390px. Every change replaces
// the venue, so the arena being edited is never changed in place.
defineProps<{ disabled?: boolean }>();
const venue = defineModel<VenueDesign | null>('venue', { required: true });

// The open panel's index, as the accordion's string value.
const open = ref<string | undefined>(undefined);
const list = ref<HTMLElement | null>(null);

const banners = (): VenueBanner[] => venue.value?.banners ?? [];

// The model only updates once the parent re-renders, so read the new venue here.
const add = () => {
    const before = banners().length;
    const next = addBanner(venue.value);
    const count = next.banners?.length ?? 0;
    if (count === before) return;
    venue.value = next;
    open.value = String(count - 1);
};

const set = (index: number, change: Partial<VenueBanner>) => {
    venue.value = setBanner(venue.value, index, change);
};

// A clear (clicking the selected toggle again) is ignored: a kind is required.
const chooseKind = (index: number, kind: unknown) => {
    if (kind) set(index, { kind: kind as BannerKindId });
};

// The moved banner's panel stays open, and focus stays on the button pressed,
// or its sibling once that one is disabled at the end of the list.
const move = async (from: number, to: number, direction: 'up' | 'down') => {
    venue.value = moveBanner(venue.value, from, to);
    open.value = String(to);
    const atEnd = direction === 'up' ? to === 0 : to === banners().length - 1;
    const target = atEnd ? (direction === 'up' ? 'down' : 'up') : direction;
    // The reopened panel mounts a few ticks later: the parent's new venue first, then the panel.
    for (let tick = 0; tick < 5; tick++) {
        await nextTick();
        const button = list.value?.querySelector<HTMLButtonElement>(`[aria-label="Move banner ${to + 1} ${target}"]`);
        if (button) return button.focus();
    }
};

const remove = (index: number) => {
    venue.value = removeBanner(venue.value, index);
    // The open panel follows its banner; the removed banner's panel closes.
    const current = open.value === undefined ? -1 : Number(open.value);
    if (current === index) open.value = undefined;
    else if (current > index) open.value = String(current - 1);
};
</script>

<template>
    <div ref="list" class="grid gap-4">
        <p v-if="banners().length === 0" class="text-sm text-muted-foreground">
            No banners yet. Hang championship or retired-number banners in the rafters.
        </p>

        <Accordion
            v-else
            v-model="open"
            type="single"
            collapsible
            class="w-full"
        >
            <AccordionItem
                v-for="(banner, index) in banners()"
                :key="index"
                :value="String(index)"
            >
                <AccordionTrigger class="py-3">
                    <span class="flex min-w-0 items-center gap-3 text-left">
                        <span
                            class="size-5 shrink-0 rounded-sm border border-border"
                            :style="{ background: banner.color }"
                            aria-hidden="true"
                        />
                        <span class="shrink-0">Banner {{ index + 1 }}</span>
                        <span class="truncate font-normal text-muted-foreground">{{ banner.title }}</span>
                    </span>
                </AccordionTrigger>
                <AccordionContent>
                    <div class="grid gap-5 pb-2">
                        <div class="grid gap-2">
                            <Label :id="`banner-${index}-kind-label`">Kind</Label>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                class="grid grid-cols-2 gap-2"
                                :aria-labelledby="`banner-${index}-kind-label`"
                                :model-value="banner.kind"
                                :disabled="disabled"
                                @update:model-value="(kind) => chooseKind(index, kind)"
                            >
                                <ToggleGroupItem v-for="kind in BANNER_KINDS" :key="kind" :value="kind">
                                    {{ BANNER_KIND_LABELS[kind] }}
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>

                        <div class="grid gap-2">
                            <Label :for="`banner-${index}-title`">Title</Label>
                            <Input
                                :id="`banner-${index}-title`"
                                :model-value="banner.title"
                                :maxlength="BANNER_TITLE_MAX"
                                :disabled="disabled"
                                :aria-describedby="`banner-${index}-title-hint`"
                                class="h-11"
                                @update:model-value="(title) => set(index, { title: String(title) })"
                            />
                            <p :id="`banner-${index}-title-hint`" class="text-xs text-muted-foreground">
                                Up to {{ BANNER_TITLE_MAX }} characters. A year or a number reads best from far away.
                            </p>
                        </div>

                        <div class="grid gap-2">
                            <Label :for="`banner-${index}-subtitle`">Subtitle</Label>
                            <Input
                                :id="`banner-${index}-subtitle`"
                                :model-value="banner.subtitle"
                                :maxlength="BANNER_SUBTITLE_MAX"
                                :disabled="disabled"
                                :aria-describedby="`banner-${index}-subtitle-hint`"
                                class="h-11"
                                @update:model-value="(subtitle) => set(index, { subtitle: String(subtitle) })"
                            />
                            <p :id="`banner-${index}-subtitle-hint`" class="text-xs text-muted-foreground">
                                Up to {{ BANNER_SUBTITLE_MAX }} characters.
                            </p>
                        </div>

                        <ColourField
                            :model-value="banner.color"
                            label="Banner colour"
                            :swatches="BANNER_SWATCHES"
                            :disabled="disabled"
                            @update:model-value="(color) => set(index, { color })"
                        />

                        <div class="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                :disabled="disabled || index === 0"
                                :aria-label="`Move banner ${index + 1} up`"
                                @click="move(index, index - 1, 'up')"
                            >
                                <ArrowUp aria-hidden="true" />
                                Up
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                :disabled="disabled || index === banners().length - 1"
                                :aria-label="`Move banner ${index + 1} down`"
                                @click="move(index, index + 1, 'down')"
                            >
                                <ArrowDown aria-hidden="true" />
                                Down
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="ml-auto text-destructive-strong"
                                :disabled="disabled"
                                :aria-label="`Remove banner ${index + 1}`"
                                @click="remove(index)"
                            >
                                <Trash2 aria-hidden="true" />
                                Remove
                            </Button>
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>

        <div class="flex flex-wrap items-center gap-3">
            <Button
                type="button"
                variant="outline"
                :disabled="disabled || banners().length >= BANNERS_MAX"
                @click="add"
            >
                <Plus aria-hidden="true" />
                Add banner
            </Button>
            <p class="text-xs text-muted-foreground" aria-live="polite">
                {{ banners().length }} of {{ BANNERS_MAX }}
            </p>
        </div>
    </div>
</template>
