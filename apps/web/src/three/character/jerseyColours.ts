// The uniform's colours, read off the team's chosen jersey image. Jerseys
// come as transparent PNGs, as drawings on a white template, or as photos
// on a plain background, so the background (white, black or transparent,
// connected to the image's edge) is ignored before counting colours.

export interface KitColours {
    primary: string;
    secondary: string;
    trim: string;
}

// A plain home kit, for teams with no jersey or one that can't be read.
export const HOME_KIT: KitColours = { primary: '#f4f4f2', secondary: '#1d2a44', trim: '#1d2a44' };

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

const isBackdrop = (data: Uint8ClampedArray, i: number) => {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    return a < 16 || (r >= 235 && g >= 235 && b >= 235) || (r <= 25 && g <= 25 && b <= 25);
};

export const sampleJerseyColours = ({ data, width, height }: Pixels): KitColours | null => {
    // Flood fill the backdrop inward from the edge, so white or black inside
    // the jersey's own art is kept.
    const backdrop = new Uint8Array(width * height);
    const queue: number[] = [];
    const visit = (x: number, y: number) => {
        const p = y * width + x;
        if (backdrop[p] || !isBackdrop(data, p * 4)) return;
        backdrop[p] = 1;
        queue.push(p);
    };
    for (let x = 0; x < width; x++) {
        visit(x, 0);
        visit(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
        visit(0, y);
        visit(width - 1, y);
    }
    while (queue.length) {
        const p = queue.pop()!;
        const x = p % width;
        const y = (p - x) / width;
        if (x > 0) visit(x - 1, y);
        if (x < width - 1) visit(x + 1, y);
        if (y > 0) visit(x, y - 1);
        if (y < height - 1) visit(x, y + 1);
    }

    // Count what's left in coarse buckets, keeping each bucket's mean colour.
    const buckets = new Map<number, { count: number; sum: [number, number, number] }>();
    let kept = 0;
    for (let p = 0; p < width * height; p++) {
        const i = p * 4;
        if (backdrop[p] || data[i + 3] < 128) continue;
        kept++;
        const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
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
        .map(({ count, sum }) => sum.map((s) => s / count));
    const primary = ranked[0];
    const secondary =
        ranked.find((rgb) => Math.hypot(...rgb.map((c, k) => c - primary[k])) >= MIN_DISTANCE) ?? primary.map((c) => c * 0.6);
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
