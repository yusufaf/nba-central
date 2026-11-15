<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PersonPreview3DAsync, Scene3DUnavailable } from '@/components/scene3d';
import type { ScenePerson } from '@/components/scene3d/people';

// The creator's sheet, shared by players and staff: the pinned 3D preview,
// the tab list under it and the footer. Each tab's controls come in through
// the slot named after its value. The tab list lives here, not in a slot,
// because its sticky offset is a scoped style that wouldn't reach one.
withDefaults(
    defineProps<{
        title: string;
        description?: string;
        submitLabel: string;
        saving?: boolean;
        valid: boolean;
        person: ScenePerson;
        label: string;
        webgl: boolean;
        tabs: readonly { value: string; label: string }[];
    }>(),
    { description: 'Changes show in the preview as you make them.', saving: false },
);
const emit = defineEmits<{ submit: [] }>();
const open = defineModel<boolean>('open', { default: false });
const tab = defineModel<string>('tab', { required: true });
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent size="sheet">
            <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="emit('submit')">
                <DialogHeader class="px-6 pt-6 pr-16 text-left">
                    <DialogTitle>{{ title }}</DialogTitle>
                    <DialogDescription>{{ description }}</DialogDescription>
                </DialogHeader>

                <!-- One scroller. In a narrow sheet the preview and the tab list
                     stay pinned at its top, so focused controls are scrolled to
                     just below them (scroll-padding), never behind. -->
                <div
                    class="creator-scroller min-h-0 flex-1 overflow-y-auto px-6 pb-6"
                    data-testid="creator-scroller"
                >
                    <div class="flex flex-col @min-[44rem]:grid @min-[44rem]:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] @min-[44rem]:items-start @min-[44rem]:gap-6">
                        <div class="sticky top-0 z-[var(--z-sticky)] -mx-6 bg-card px-6 pt-4 pb-2 @min-[44rem]:mx-0 @min-[44rem]:px-0">
                            <div class="creator-preview">
                                <PersonPreview3DAsync v-if="webgl" :person="person" :label="label" />
                                <Scene3DUnavailable v-else reason="no-webgl" />
                            </div>
                        </div>

                        <Tabs v-model="tab" class="creator-tabs-column flex min-w-0 flex-col">
                            <TabsList
                                class="creator-tabs sticky z-[var(--z-sticky)] grid h-auto w-full grid-cols-3 gap-1"
                            >
                                <TabsTrigger v-for="item in tabs" :key="item.value" :value="item.value">{{ item.label }}</TabsTrigger>
                            </TabsList>

                            <TabsContent v-for="item in tabs" :key="item.value" :value="item.value" class="mt-0 pt-4">
                                <slot :name="item.value" />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <DialogFooter class="flex-row justify-end gap-2 border-t border-border px-6 py-4 *:flex-1 @min-[32rem]:*:flex-none">
                    <Button type="button" variant="outline" :disabled="saving" @click="open = false">Cancel</Button>
                    <Button type="submit" :disabled="!valid || saving">
                        {{ saving ? 'Saving…' : submitLabel }}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>

<style scoped>
/* The pinned stack's height, shared by the preview, the tab list under it
   and the scroller's padding: Shift+Tab then scrolls a control to just below
   the stack (preview + its 1.5rem padding + the tab list), not behind it. */
.creator-scroller {
    --creator-preview-h: min(42dvh, 22rem);
    scroll-padding-top: calc(var(--creator-preview-h) + 1.5rem + 5.5rem);
}

.creator-preview {
    height: var(--creator-preview-h);
}

.creator-tabs {
    top: calc(var(--creator-preview-h) + 1.5rem);
}

/* Side by side: the preview is taller and nothing sits above the tabs.
   Here, not as Tailwind variants: scoped rules outrank utilities. */
@container (min-width: 44rem) {
    .creator-scroller {
        scroll-padding-top: 0;
    }

    .creator-preview {
        height: min(70dvh, 36rem);
    }

    /* Level with the preview, and already at its sticky offset, so the
       pinned tab list never slides over the panel below it. */
    .creator-tabs-column {
        padding-top: 1rem;
    }

    .creator-tabs {
        top: 1rem;
    }
}
</style>
