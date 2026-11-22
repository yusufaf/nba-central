import { BufferAttribute, BufferGeometry, CanvasTexture, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { contrastRatio } from '@/utils/court';
import { bannersDesign, type BannerDesign } from '@/utils/venue';

// Validation lives in src/utils (three-free), so the loading placeholder can use it.
export { bannersDesign, type BannerDesign };

// Rafters banners (#297): one straight row on the far side, top-aligned,
// facing the court. Fewer banners hang bigger. Its depth and top keep every
// banner above the scoreboard's sightline from Broadcast and out of the
// team-photo shot; tests/three/venueVisibility.test.ts checks both.
export const BANNER_ROW = { z: -14, top: 16.25, span: 18.5, maxWidth: 3.5, gap: 0.25, heightPerWidth: 1.25 };

// Atlas cells are 256 x 320 (the banners' 1.25 aspect); text fits a 216 px box
// by font size. textWidth / (CHAR_EM * cap) is how many characters fit at a cap.
export const BANNER_FONT = {
    title: 84,
    number: 150,
    subtitle: 34,
    textWidth: 216,
    family: 'Inter, sans-serif',
    weight: 800,
};

const ATLAS = { columns: 4, rows: 2, cell: { width: 256, height: 320 } };
// Bold upper-case Inter advances about this many ems a character.
const CHAR_EM = 0.62;
const LEADING = 1.15;
/** Each banner's centre x and size, left to right. */
export const bannerLayout = (count: number): { x: number; width: number; height: number }[] => {
    const { span, maxWidth, gap, heightPerWidth } = BANNER_ROW;
    const width = Math.min(maxWidth, (span - (count - 1) * gap) / count);
    const total = count * width + (count - 1) * gap;
    return Array.from({ length: count }, (_, i) => ({
        x: -total / 2 + width / 2 + i * (width + gap),
        width,
        height: width * heightPerWidth,
    }));
};

/** How many characters fit the text box at a font cap. */
export const lineChars = (cap: number): number => Math.floor(BANNER_FONT.textWidth / (CHAR_EM * cap));

/**
 * One line if it fits at the cap or can't break, else two, split at the space
 * nearest the middle: a split's longer line is shorter than the whole, so its
 * fitted font is never smaller.
 */
export const bannerLines = (text: string, maxChars: number): string[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.length <= maxChars || !trimmed.includes(' ')) return [trimmed];
    const middle = trimmed.length / 2;
    let split = -1;
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === ' ' && (split < 0 || Math.abs(i - middle) < Math.abs(split - middle))) split = i;
    }
    return [trimmed.slice(0, split).trim(), trimmed.slice(split + 1).trim()];
};

export const bannerTextColour = (color: string): '#ffffff' | '#000000' =>
    contrastRatio(color, '#ffffff') >= contrastRatio(color, '#000000') ? '#ffffff' : '#000000';

const bannerFont = (px: number): string => `${BANNER_FONT.weight} ${px}px ${BANNER_FONT.family}`;

// Sets the context's font to the cap, or smaller so the line fits the text box.
const fitFont = (context: CanvasRenderingContext2D, text: string, cap: number): number => {
    context.font = bannerFont(cap);
    const width = context.measureText(text).width;
    const px = width > BANNER_FONT.textWidth ? (cap * BANNER_FONT.textWidth) / width : cap;
    context.font = bannerFont(px);
    return px;
};

const cellOrigin = (index: number): { x: number; y: number } => ({
    x: (index % ATLAS.columns) * ATLAS.cell.width,
    y: Math.floor(index / ATLAS.columns) * ATLAS.cell.height,
});

const drawBanner = (context: CanvasRenderingContext2D, banner: BannerDesign, index: number): void => {
    const { width, height } = ATLAS.cell;
    const { x, y } = cellOrigin(index);
    const ink = bannerTextColour(banner.color);
    context.fillStyle = banner.color;
    context.fillRect(x, y, width, height);
    context.strokeStyle = ink;
    context.lineWidth = 4;
    context.strokeRect(x + 10, y + 10, width - 20, height - 20);

    const titleCap = banner.kind === 'number' ? BANNER_FONT.number : BANNER_FONT.title;
    const titleLines =
        banner.kind === 'number'
            ? bannerLines(banner.title, Infinity)
            : bannerLines(banner.title, lineChars(BANNER_FONT.title));
    const lines = [
        ...titleLines.map((text) => ({ text: text.toUpperCase(), cap: titleCap })),
        ...bannerLines(banner.subtitle, lineChars(BANNER_FONT.subtitle)).map((text) => ({
            text: text.toUpperCase(),
            cap: BANNER_FONT.subtitle,
        })),
    ];
    const sized = lines.map((line) => ({ ...line, px: fitFont(context, line.text, line.cap) }));
    const total = sized.reduce((sum, line) => sum + line.px * LEADING, 0);
    let top = y + (height - total) / 2;
    context.fillStyle = ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const line of sized) {
        const lineHeight = line.px * LEADING;
        context.font = bannerFont(line.px);
        context.fillText(line.text, x + width / 2, top + lineHeight / 2);
        top += lineHeight;
    }
};

/** Every banner in one texture, a 4 x 2 grid of cells in list order. */
export const bannerAtlas = (banners: BannerDesign[]): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS.columns * ATLAS.cell.width;
    canvas.height = ATLAS.rows * ATLAS.cell.height;
    const context = canvas.getContext('2d');
    if (context) banners.forEach((banner, i) => drawBanner(context, banner, i));
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

// Per banner, a front quad facing the court (+z) and a back quad facing the
// far seats, its u mirrored so the text reads from behind too. v = 1 is the
// canvas top (CanvasTexture flips y).
const bannersGeometry = (count: number): BufferGeometry => {
    const { z, top } = BANNER_ROW;
    const positions: number[] = [];
    const uvs: number[] = [];
    bannerLayout(count).forEach(({ x, width, height }, i) => {
        const left = x - width / 2;
        const right = x + width / 2;
        const bottom = top - height;
        const column = i % ATLAS.columns;
        const row = Math.floor(i / ATLAS.columns);
        const [u0, u1] = [column / ATLAS.columns, (column + 1) / ATLAS.columns];
        const [v0, v1] = [1 - (row + 1) / ATLAS.rows, 1 - row / ATLAS.rows];
        const corner = {
            bottomLeft: [left, bottom, z],
            bottomRight: [right, bottom, z],
            topRight: [right, top, z],
            topLeft: [left, top, z],
        };
        const front: [number[], [number, number]][] = [
            [corner.bottomLeft, [u0, v0]],
            [corner.bottomRight, [u1, v0]],
            [corner.topRight, [u1, v1]],
            [corner.topLeft, [u0, v1]],
        ];
        const back: [number[], [number, number]][] = [
            [corner.bottomRight, [u0, v0]],
            [corner.bottomLeft, [u1, v0]],
            [corner.topLeft, [u1, v1]],
            [corner.topRight, [u0, v1]],
        ];
        for (const quad of [front, back]) {
            for (const k of [0, 1, 2, 0, 2, 3]) {
                positions.push(...quad[k][0]);
                uvs.push(...quad[k][1]);
            }
        }
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    return geometry;
};

// One mesh and one draw call, 4 triangles a banner. Unlit and unfogged, like
// the scoreboard's screens, so the far banners stay readable.
export const buildBanners = (banners: BannerDesign[]): Mesh => {
    const mesh = new Mesh(
        bannersGeometry(banners.length),
        new MeshBasicMaterial({ map: bannerAtlas(banners), fog: false }),
    );
    mesh.name = 'banners';
    return mesh;
};
