// The uniform's colours, read off the team's chosen jersey image. Jerseys
// come as transparent PNGs, as drawings on a white template, or as photos
// on a plain background, so the background (white, black or transparent,
// connected to the image's edge) is ignored before counting colours.

export interface KitColours {
    primary: string;
    secondary: string;
    trim: string;
}

// A plain kit for teams with no jersey or one that can't be read. Royal blue,
// not white: a white kit barely shows on the light grey figurines.
export const HOME_KIT: KitColours = { primary: '#2f5d9b', secondary: '#f4f4f2', trim: '#ffffff' };

// A backdrop pixel's neighbour joins the backdrop if every channel is within
// this of it, which follows the database's soft gradients.
const BACKDROP_STEP = 12;
// A bucket whose mean colour spreads less than this across its channels is a
// neutral (white, grey, black): a kit colour only if nothing more colourful is.
const MIN_CHROMA = 40;
const MIN_COLOURED_SHARE = 0.06;
const TRIM_LIGHT = '#ffffff';
const TRIM_DARK = '#111418';
const MIN_DISTANCE = 60;
const MIN_SHARE = 0.02;
const SAMPLE_WIDTH = 128;

interface Pixels {
    data: Uint8ClampedArray;
    width: number;
    height: number;
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const close = (data: Uint8ClampedArray, i: number, j: number) =>
    Math.abs(data[i] - data[j]) <= BACKDROP_STEP &&
    Math.abs(data[i + 1] - data[j + 1]) <= BACKDROP_STEP &&
    Math.abs(data[i + 2] - data[j + 2]) <= BACKDROP_STEP;
const clear = (data: Uint8ClampedArray, i: number) => data[i + 3] < 16;
const chroma = (rgb: number[]) => Math.max(...rgb) - Math.min(...rgb);

export const sampleJerseyColours = ({ data, width, height }: Pixels): KitColours | null => {
    // Flood fill the backdrop inward from every edge pixel, stepping to any
    // neighbour close to the pixel it came from: plain, transparent and
    // gradient backdrops all go, while colour inside the art (including a white
    // kit behind its outline) is kept.
    const backdrop = new Uint8Array(width * height);
    const queue: number[] = [];
    const seed = (x: number, y: number) => {
        const p = y * width + x;
        if (backdrop[p]) return;
        backdrop[p] = 1;
        queue.push(p);
    };
    for (let x = 0; x < width; x++) {
        seed(x, 0);
        seed(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
        seed(0, y);
        seed(width - 1, y);
    }
    while (queue.length) {
        const p = queue.pop()!;
        const x = p % width;
        const y = (p - x) / width;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const q = ny * width + nx;
            if (backdrop[q]) continue;
            if (clear(data, q * 4) || (!clear(data, p * 4) && close(data, p * 4, q * 4))) {
                backdrop[q] = 1;
                queue.push(q);
            }
        }
    }

    // Count what's left in coarse buckets, keeping each bucket's mean colour.
    const buckets = new Map<number, { count: number; sum: [number, number, number] }>();
    let kept = 0;
    for (let p = 0; p < width * height; p++) {
        const i = p * 4;
        if (backdrop[p] || data[i + 3] < 128) continue;
        kept++;
        const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
        const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
        bucket.count++;
        bucket.sum[0] += data[i];
        bucket.sum[1] += data[i + 1];
        bucket.sum[2] += data[i + 2];
        buckets.set(key, bucket);
    }
    if (kept < width * height * MIN_SHARE) return null;

    const ranked = [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .map(({ count, sum }) => ({ count, rgb: sum.map((s) => s / count) }));
    // Most jerseys come as a white home kit beside a coloured road kit; the
    // coloured one says more about the team, so it leads when it's big enough.
    const coloured = ranked.find(({ count, rgb }) => chroma(rgb) >= MIN_CHROMA && count >= kept * MIN_COLOURED_SHARE);
    const primary = (coloured ?? ranked[0]).rgb;
    const secondary =
        ranked.find(({ rgb }) => Math.hypot(...rgb.map((c, k) => c - primary[k])) >= MIN_DISTANCE)?.rgb ??
        primary.map((c) => c * 0.6);
    const light = [255, 255, 255];
    const dark = [17, 20, 24];
    return {
        primary: toHex(primary),
        secondary: toHex(secondary),
        trim: contrast(primary, light) >= contrast(primary, dark) ? TRIM_LIGHT : TRIM_DARK,
    };
};

const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`jersey image failed: ${url}`));
        image.src = url;
    });

export const loadJerseyColours = async (url: string | undefined): Promise<KitColours> => {
    if (!url) return HOME_KIT;
    try {
        const image = await loadImage(url);
        const width = Math.min(SAMPLE_WIDTH, image.naturalWidth || SAMPLE_WIDTH);
        const height = Math.max(1, Math.round((width * (image.naturalHeight || width)) / (image.naturalWidth || width)));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return HOME_KIT;
        context.drawImage(image, 0, 0, width, height);
        return sampleJerseyColours(context.getImageData(0, 0, width, height)) ?? HOME_KIT;
    } catch {
        return HOME_KIT;
    }
};
