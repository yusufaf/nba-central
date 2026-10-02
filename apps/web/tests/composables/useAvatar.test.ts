import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/network/api', () => ({
    settingsApi: { get: vi.fn(), update: vi.fn(), initialize: vi.fn() },
    profileApi: { getStats: vi.fn(), uploadAvatar: vi.fn() },
}));
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn() } }));
const currentUser = ref<{ id: string; username: string | null; memberSince: Date | null } | null>(
    null,
);
vi.mock('@/composables/useCurrentUser', () => ({
    useCurrentUser: () => ({ currentUser }),
}));
// jsdom can't decode or draw images; validation stays real.
vi.mock('@/utils/avatarImage', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils/avatarImage')>()),
    resizeAvatar: vi.fn(async () => new Blob(['resized'])),
    blobToBase64: vi.fn(async () => 'cmVzaXplZA=='),
}));

import { profileApi, settingsApi } from '@/network/api';
import { settingsSync, useSettingsSync } from '@/composables/useSettingsSync';
import {
    generatedAvatarSeed,
    renderGeneratedAvatar,
    useAvatar,
    useGeneratedAvatars,
} from '@/composables/useAvatar';
import { resizeAvatar } from '@/utils/avatarImage';

const UPLOAD_URL = 'https://cdn.example/avatars/u1/1.webp';

const signIn = async (settings: Record<string, unknown> = {}, avatarUrl: string | null = null) => {
    vi.mocked(settingsApi.get).mockResolvedValue({
        success: true,
        data: { settings, updatedAt: '2026-09-01T00:00:00.000Z', avatarUrl },
    });
    currentUser.value = { id: 'u1', username: 'hooper', memberSince: null };
    await settingsSync.start('u1');
};

beforeEach(() => {
    settingsSync.stop();
    currentUser.value = null;
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(settingsApi.update).mockImplementation(async (settings) => ({
        success: true,
        data: { settings, updatedAt: 'x' },
    }));
});

describe('generated avatars', () => {
    it('are seeded by the user id and their index', () => {
        expect(generatedAvatarSeed('u1', 'generated-0')).toBe('u1:0');
        expect(generatedAvatarSeed('u1', 'generated-7')).toBe('u1:7');
    });

    it('render the same SVG for the same seed, and a different one per seed', async () => {
        const first = await renderGeneratedAvatar('u1:0');
        expect(first).toMatch(/^data:image\/svg\+xml/);
        expect(await renderGeneratedAvatar('u1:0')).toBe(first);
        expect(await renderGeneratedAvatar('u1:1')).not.toBe(first);
        expect(await renderGeneratedAvatar('u2:0')).not.toBe(first);
    });

    it("offers the signed-in user's eight", async () => {
        await signIn();
        const avatars = useGeneratedAvatars();
        await flushPromises();
        await vi.waitFor(() => expect(avatars.value.every((a) => a.src)).toBe(true));

        expect(avatars.value.map((a) => a.choice)).toEqual([
            'generated-0',
            'generated-1',
            'generated-2',
            'generated-3',
            'generated-4',
            'generated-5',
            'generated-6',
            'generated-7',
        ]);
        expect(avatars.value[2].src).toBe(await renderGeneratedAvatar('u1:2'));
    });
});

describe('useAvatar', () => {
    it('has no image signed out', () => {
        expect(useAvatar().src.value).toBeNull();
    });

    it('has no image for "none", the default', async () => {
        await signIn();
        expect(useAvatar().src.value).toBeNull();
    });

    it("shows the chosen generated avatar once it's rendered", async () => {
        await signIn({ 'profile.avatar': 'generated-5' });
        const { src } = useAvatar();

        await vi.waitFor(() => expect(src.value).not.toBeNull());
        expect(src.value).toBe(await renderGeneratedAvatar('u1:5'));
    });

    it('shows the uploaded image for "upload"', async () => {
        await signIn({ 'profile.avatar': 'upload' }, UPLOAD_URL);
        expect(useAvatar().src.value).toBe(UPLOAD_URL);
    });

    it('falls back to none when "upload" is chosen but nothing was uploaded', async () => {
        await signIn({ 'profile.avatar': 'upload' }, null);
        expect(useAvatar().src.value).toBeNull();
    });

    it('saves a choice as the profile.avatar setting', async () => {
        await signIn();
        const { choose, choice } = useAvatar();

        choose('generated-2');
        await nextTick();
        await flushPromises();

        expect(choice.value).toBe('generated-2');
        expect(settingsApi.update).toHaveBeenCalledWith({ 'profile.avatar': 'generated-2' });
    });
});

describe('useAvatar upload', () => {
    const file = (type = 'image/png', size = 2000) => {
        const f = new File(['x'], 'me.png', { type });
        Object.defineProperty(f, 'size', { value: size });
        return f;
    };

    it('uploads the resized image, then selects and shows it', async () => {
        await signIn();
        vi.mocked(profileApi.uploadAvatar).mockResolvedValue({
            success: true,
            data: { avatarUrl: UPLOAD_URL },
        });
        const { upload, src } = useAvatar();
        const { avatarUrl } = useSettingsSync();

        expect(await upload(file())).toEqual({ ok: true });
        await flushPromises();

        expect(resizeAvatar).toHaveBeenCalledTimes(1);
        expect(profileApi.uploadAvatar).toHaveBeenCalledWith('cmVzaXplZA==');
        expect(settingsApi.update).toHaveBeenCalledWith({ 'profile.avatar': 'upload' });
        expect(avatarUrl.value).toBe(UPLOAD_URL);
        expect(src.value).toBe(UPLOAD_URL);
    });

    it('turns away the wrong type or size before doing any work', async () => {
        await signIn();
        const { upload } = useAvatar();

        expect(await upload(file('image/svg+xml'))).toEqual({
            ok: false,
            message: 'Choose a PNG, JPEG or WebP image.',
        });
        expect(await upload(file('image/png', 10 * 1024 * 1024 + 1))).toEqual({
            ok: false,
            message: 'Choose an image under 10 MB.',
        });
        expect(resizeAvatar).not.toHaveBeenCalled();
        expect(profileApi.uploadAvatar).not.toHaveBeenCalled();
    });

    it("passes on the server's reason for a 400, and a generic one for a 500", async () => {
        await signIn();
        const { upload, choice } = useAvatar();

        vi.mocked(profileApi.uploadAvatar).mockRejectedValueOnce({
            response: { status: 400, data: { error: 'Avatar must be a PNG, JPEG or WebP image' } },
        });
        expect(await upload(file())).toEqual({
            ok: false,
            message: 'Avatar must be a PNG, JPEG or WebP image',
        });

        vi.mocked(profileApi.uploadAvatar).mockRejectedValueOnce({ response: { status: 500 } });
        expect(await upload(file())).toEqual({
            ok: false,
            message: 'Something went wrong on our end. Please try again later.',
        });
        expect(choice.value).toBe('none');
    });

    it("explains a file the browser can't read as an image", async () => {
        await signIn();
        vi.mocked(resizeAvatar).mockRejectedValueOnce(
            new Error("That file couldn't be read as an image."),
        );

        expect(await useAvatar().upload(file())).toEqual({
            ok: false,
            message: "That file couldn't be read as an image.",
        });
    });

    it('drops the result if the account changed while it uploaded', async () => {
        await signIn();
        let finish!: (value: { success: true; data: { avatarUrl: string } }) => void;
        vi.mocked(profileApi.uploadAvatar).mockReturnValue(
            new Promise((resolve) => (finish = resolve)),
        );
        const { upload } = useAvatar();
        const { avatarUrl } = useSettingsSync();

        const pending = upload(file());
        await flushPromises();
        settingsSync.stop();
        currentUser.value = null;
        finish({ success: true, data: { avatarUrl: UPLOAD_URL } });
        await pending;

        expect(avatarUrl.value).toBeNull();
        expect(settingsApi.update).not.toHaveBeenCalled();
    });
});
