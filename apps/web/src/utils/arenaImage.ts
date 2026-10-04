// The arena photo is resized in the browser and always encoded as JPEG. The
// avatar's WebP encode isn't reused: browsers that can't encode WebP
// (Safari) silently fall back to PNG, which at 1600px is several MB and
// would fail the server's 1 MB limit.

export const ARENA_PHOTO_LONG_EDGE = 1600;
// Under the server's 1 MB, with room to spare.
export const ARENA_PHOTO_MAX_BYTES = 900 * 1024;

const FIRST_QUALITY = 0.85;
const QUALITY_STEP = 0.1;
const LOWEST_QUALITY = 0.35;

export const fitLongEdge = (width: number, height: number, longEdge = ARENA_PHOTO_LONG_EDGE) => {
    const scale = Math.min(1, longEdge / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

/**
 * Encodes at quality 0.85 and steps down by 0.1 until the photo is under
 * ARENA_PHOTO_MAX_BYTES. At 1600px that is nearly always the first or second
 * try; the floor stops a pathological image from looping forever.
 */
export const encodeUnderLimit = async (
    encode: (quality: number) => Promise<Blob | null>,
): Promise<Blob> => {
    // Counted in whole steps: adding 0.1 repeatedly drifts off 0.35.
    const steps = Math.round((FIRST_QUALITY - LOWEST_QUALITY) / QUALITY_STEP);
    for (let step = 0; step <= steps; step++) {
        const blob = await encode(FIRST_QUALITY - step * QUALITY_STEP);
        if (!blob) throw new Error("Your browser couldn't resize the image.");
        if (blob.size < ARENA_PHOTO_MAX_BYTES) return blob;
    }
    throw new Error("That photo couldn't be made small enough. Try a smaller image.");
};

// Draws the image onto a canvas scaled to `longEdge` (never up). Drawing it
// also drops its metadata (camera, location).
const drawFitted = async (file: File, longEdge: number, background?: string) => {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error("That file couldn't be read as an image.");
    }
    const { width, height } = fitLongEdge(bitmap.width, bitmap.height, longEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
        bitmap.close();
        throw new Error("Your browser couldn't resize the image.");
    }
    if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas;
};

/** Scales the photo to a 1600px long edge (never up) and encodes it as JPEG. */
export const resizeArenaPhoto = async (file: File): Promise<Blob> => {
    // JPEG has no alpha: a transparent PNG would otherwise turn black.
    const canvas = await drawFitted(file, ARENA_PHOTO_LONG_EDGE, 'white');
    return encodeUnderLimit(
        (quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality)),
    );
};

// The centre circle is about 100 units of a 1040-unit court, so even the
// 1200px share card draws it near 115px: 512 leaves room for 4x screens.
export const COURT_LOGO_EDGE = 512;

/**
 * Scales a centre logo to a 512px long edge and keeps it PNG, so its
 * transparency shows the paint behind it. At 512px that is far under the
 * limit for anything logo-like; a photo full of noise is refused.
 */
export const resizeCourtLogo = async (file: File): Promise<Blob> => {
    const canvas = await drawFitted(file, COURT_LOGO_EDGE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error("Your browser couldn't resize the image.");
    if (blob.size >= ARENA_PHOTO_MAX_BYTES) {
        throw new Error('That logo is too detailed to fit in 1 MB. Try a simpler image.');
    }
    return blob;
};
