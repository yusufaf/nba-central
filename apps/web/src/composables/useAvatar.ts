import { computed, reactive, watchEffect } from 'vue';
import type { Style } from '@dicebear/core';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useProfilePreferences } from '@/composables/useProfilePreferences';
import { settingsSync, useSettingsSync } from '@/composables/useSettingsSync';
import { getApiErrorMessage } from '@/composables/useApiErrorMessage';
import { profileApi } from '@/network/api';
import {
    GENERATED_AVATAR_COUNT,
    type AvatarChoice,
    type GeneratedAvatar,
} from '@/constants/preferences';
import { blobToBase64, resizeAvatar, validateAvatarFile } from '@/utils/avatarImage';

/*
 * Generated avatars are DiceBear "thumbs", rendered here in the browser:
 * no request leaves the app, and the setting only stores which of the
 * user's eight it is. Each is seeded by the user id plus its index, so an
 * account sees the same eight on every device and nobody else sees them.
 *
 * DiceBear and the style load on first use, as their own chunk, so a
 * signed-out visitor never downloads them.
 */

export const GENERATED_AVATARS: GeneratedAvatar[] = Array.from(
    { length: GENERATED_AVATAR_COUNT },
    (_, index) => `generated-${index}` as GeneratedAvatar,
);

export const generatedAvatarSeed = (userId: string, choice: GeneratedAvatar) =>
    `${userId}:${choice.slice('generated-'.length)}`;

const isGenerated = (choice: AvatarChoice): choice is GeneratedAvatar =>
    choice.startsWith('generated-');

let style: Promise<Style> | null = null;
const loadStyle = () =>
    (style ??= Promise.all([
        import('@dicebear/core'),
        import('@dicebear/styles/thumbs.json'),
    ]).then(([{ Style }, definition]) => new Style(definition.default)));

export const renderGeneratedAvatar = async (seed: string): Promise<string> => {
    const [{ Avatar }, thumbs] = await Promise.all([import('@dicebear/core'), loadStyle()]);
    return new Avatar(thumbs, { seed }).toDataUri();
};

// Rendered data URIs by seed, shared by every avatar on the page.
const rendered = reactive(new Map<string, string>());
const requested = new Set<string>();

const request = (seed: string) => {
    if (requested.has(seed)) return;
    requested.add(seed);
    renderGeneratedAvatar(seed)
        .then((uri) => rendered.set(seed, uri))
        .catch((error) => {
            // A failed chunk load can be tried again next time.
            requested.delete(seed);
            style = null;
            console.error('Failed to render avatar:', error);
        });
};

/** The signed-in user's eight generated avatars, for the picker. */
export const useGeneratedAvatars = () => {
    const { currentUser } = useCurrentUser();

    watchEffect(() => {
        const userId = currentUser.value?.id;
        if (userId) GENERATED_AVATARS.forEach((choice) => request(generatedAvatarSeed(userId, choice)));
    });

    return computed(() =>
        GENERATED_AVATARS.map((choice) => {
            const userId = currentUser.value?.id;
            return {
                choice,
                src: userId ? (rendered.get(generatedAvatarSeed(userId, choice)) ?? null) : null,
            };
        }),
    );
};

export type AvatarUploadResult = { ok: true } | { ok: false; message: string };

/**
 * The signed-in user's avatar: `src` is null for none, and also until a
 * generated one has rendered, so callers show their fallback icon meanwhile.
 */
export const useAvatar = () => {
    const { currentUser } = useCurrentUser();
    const { preferences } = useProfilePreferences();
    const { avatarUrl } = useSettingsSync();

    const generatedSeed = computed(() => {
        const userId = currentUser.value?.id;
        const choice = preferences.value.avatar;
        return userId && isGenerated(choice) ? generatedAvatarSeed(userId, choice) : null;
    });

    watchEffect(() => {
        if (generatedSeed.value) request(generatedSeed.value);
    });

    const src = computed<string | null>(() => {
        if (!currentUser.value) return null;
        if (preferences.value.avatar === 'upload') return avatarUrl.value;
        return generatedSeed.value ? (rendered.get(generatedSeed.value) ?? null) : null;
    });

    const choose = (choice: AvatarChoice) => {
        preferences.value.avatar = choice;
    };

    /** Resizes, uploads and selects the image; the message is user-facing. */
    const upload = async (file: File): Promise<AvatarUploadResult> => {
        const problem = validateAvatarFile(file);
        if (problem) return { ok: false, message: problem };

        const userId = currentUser.value?.id;
        try {
            const image = await blobToBase64(await resizeAvatar(file));
            const response = await profileApi.uploadAvatar(image);
            if (!response.success) return { ok: false, message: response.error };
            // Signed out or switched account while it uploaded.
            if (currentUser.value?.id !== userId) return { ok: true };
            settingsSync.setAvatarUrl(response.data.avatarUrl);
            choose('upload');
            return { ok: true };
        } catch (error) {
            return { ok: false, message: getApiErrorMessage(error, "Couldn't upload your image.") };
        }
    };

    return {
        src,
        choice: computed(() => preferences.value.avatar),
        choose,
        upload,
    };
};
