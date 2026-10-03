<script setup lang="ts">
import { ref } from 'vue';
import { CircleUser, Loader2, Upload } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAvatar, useGeneratedAvatars } from '@/composables/useAvatar';
import { useSettingsSync } from '@/composables/useSettingsSync';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { AVATAR_FILE_TYPES } from '@/utils/avatarImage';
import type { AvatarChoice } from '@/constants/preferences';

const open = defineModel<boolean>('open', { required: true });

const { currentUser } = useCurrentUser();
const { choice, choose, upload } = useAvatar();
const { avatarUrl, isSaving } = useSettingsSync();
const generated = useGeneratedAvatars();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const uploadError = ref<string | null>(null);

// A single-select ToggleGroup emits '' when the selected item is clicked
// again; keep the current choice instead of clearing it.
const onChoose = (value: unknown) => {
    if (typeof value === 'string' && value) choose(value as AvatarChoice);
};

const onFileChosen = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still fires change.
    input.value = '';
    if (!file) return;

    uploadError.value = null;
    uploading.value = true;
    const result = await upload(file);
    uploading.value = false;
    if (!result.ok) uploadError.value = result.message;
};
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent size="sm">
            <DialogHeader>
                <DialogTitle>Choose your avatar</DialogTitle>
                <DialogDescription>
                    Pick one made for your account, or upload an image. It shows on
                    Settings and in the menu.
                </DialogDescription>
            </DialogHeader>

            <div class="flex items-center gap-2">
                <span class="text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-foreground/50">
                    Avatar
                </span>
                <Loader2
                    v-if="isSaving('profile.avatar')"
                    class="size-3.5 animate-spin text-primary-strong"
                    aria-label="Saving"
                    data-testid="setting-saving"
                />
            </div>

            <!-- auto-fill at 3.5rem, not a fixed column count, so the grid
                 reflows with Text size instead of overflowing the dialog. -->
            <ToggleGroup
                type="single"
                variant="outline"
                class="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2"
                aria-label="Avatar"
                :model-value="choice"
                :disabled="isSaving('profile.avatar') || uploading"
                @update:model-value="onChoose"
            >
                <ToggleGroupItem
                    value="none"
                    aria-label="No avatar"
                    class="aspect-square h-auto p-1.5"
                >
                    <CircleUser class="size-full text-foreground/60" aria-hidden="true" />
                </ToggleGroupItem>
                <ToggleGroupItem
                    v-for="(option, index) in generated"
                    :key="option.choice"
                    :value="option.choice"
                    :aria-label="`Generated avatar ${index + 1}`"
                    class="aspect-square h-auto p-1.5"
                    :data-testid="`avatar-option-${option.choice}`"
                >
                    <img
                        v-if="option.src"
                        :src="option.src"
                        alt=""
                        class="size-full rounded-full"
                    />
                    <span v-else class="size-full animate-pulse rounded-full bg-muted" />
                </ToggleGroupItem>
                <ToggleGroupItem
                    v-if="avatarUrl"
                    value="upload"
                    aria-label="Your uploaded image"
                    class="aspect-square h-auto p-1.5"
                    data-testid="avatar-option-upload"
                >
                    <img :src="avatarUrl" alt="" class="size-full rounded-full object-cover" />
                </ToggleGroupItem>
            </ToggleGroup>

            <div class="flex flex-col gap-2">
                <input
                    ref="fileInput"
                    type="file"
                    class="hidden"
                    :accept="AVATAR_FILE_TYPES.join(',')"
                    data-testid="avatar-file-input"
                    @change="onFileChosen"
                />
                <Button
                    variant="outline"
                    class="self-start"
                    :disabled="uploading || !currentUser"
                    @click="fileInput?.click()"
                >
                    <Loader2 v-if="uploading" class="size-4 animate-spin" aria-hidden="true" />
                    <Upload v-else class="size-4" aria-hidden="true" />
                    {{ uploading ? 'Uploading...' : 'Upload an image' }}
                </Button>
                <p class="text-[0.8125rem] text-foreground/60">
                    PNG, JPEG or WebP, up to 10 MB. It's cropped to a square.
                </p>
                <p
                    v-if="uploadError"
                    class="text-[0.8125rem] font-medium text-destructive-strong"
                    role="alert"
                    data-testid="avatar-upload-error"
                >
                    {{ uploadError }}
                </p>
            </div>
        </DialogContent>
    </Dialog>
</template>
