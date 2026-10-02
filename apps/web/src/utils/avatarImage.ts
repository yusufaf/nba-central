// What the avatar upload accepts from the file picker. The server checks the
// bytes again (and its own 1 MB cap, on the resized image), so these exist
// to give a clear message before any work is done.
export const AVATAR_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_AVATAR_FILE_BYTES = 10 * 1024 * 1024;
// Twice the largest place it's shown (the 4rem profile card avatar at 2x DPR
// and 137.5% text size is ~176px), so it stays sharp everywhere.
export const AVATAR_SIZE = 256;

export const validateAvatarFile = (file: File): string | null => {
    if (!(AVATAR_FILE_TYPES as readonly string[]).includes(file.type)) {
        return 'Choose a PNG, JPEG or WebP image.';
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
        return 'Choose an image under 10 MB.';
    }
    return null;
};

/**
 * Crops the image to a centred square and scales it to AVATAR_SIZE. Drawing
 * it onto a canvas also drops its metadata (camera, location). WebP where
 * the browser can encode it; canvas falls back to PNG where it can't, which
 * the server accepts too.
 */
export const resizeAvatar = async (file: File): Promise<Blob> => {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error("That file couldn't be read as an image.");
    }
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Your browser couldn't resize the image.");
    context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        AVATAR_SIZE,
        AVATAR_SIZE,
    );
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.9),
    );
    if (!blob) throw new Error("Your browser couldn't resize the image.");
    return blob;
};

export const blobToBase64 = async (blob: Blob): Promise<string> => {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    // In chunks: spreading a large array into one call overflows the stack.
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
};
