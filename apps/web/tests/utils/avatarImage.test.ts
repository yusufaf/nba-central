import { describe, it, expect } from 'vitest';
import { blobToBase64, validateAvatarFile } from '@/utils/avatarImage';

const file = (type: string, size: number) => {
    const f = new File(['x'], 'me', { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
};

describe('validateAvatarFile', () => {
    it('accepts PNG, JPEG and WebP up to 10 MB', () => {
        for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
            expect(validateAvatarFile(file(type, 10 * 1024 * 1024))).toBeNull();
        }
    });

    it('turns away other types, SVG and GIF included', () => {
        for (const type of ['image/svg+xml', 'image/gif', 'application/pdf', '']) {
            expect(validateAvatarFile(file(type, 100))).toBe('Choose a PNG, JPEG or WebP image.');
        }
    });

    it('turns away anything over 10 MB', () => {
        expect(validateAvatarFile(file('image/png', 10 * 1024 * 1024 + 1))).toBe(
            'Choose an image under 10 MB.',
        );
    });
});

describe('blobToBase64', () => {
    it('encodes every byte, past the chunk size too', async () => {
        const bytes = Uint8Array.from({ length: 100_000 }, (_, i) => i % 256);

        const encoded = await blobToBase64(new Blob([bytes]));

        expect(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))).toEqual(bytes);
    });
});
