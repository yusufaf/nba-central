import {
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    FrontSide,
    Mesh,
    MeshBasicMaterial,
    RepeatWrapping,
    SRGBColorSpace,
    type Object3D,
    type Texture,
} from 'three';
import { RIBBON_TEXT_MAX, type VenueDesign } from '@/constants/venue';
import { SEGMENTS, bowlRingPoint, type Deck } from './bowl';
import { SCENE_COLOURS } from './palette';

// The LED ribbon (#296): a band of light around the bowl, between the decks
// or, with one deck, on the wall above the last row.
export const RIBBON_HEIGHT_M = 1.2;
// One tile of the texture: 1024×64 px is 16:1, so the text isn't stretched.
export const RIBBON_TILE_M = 19.2;
export const RIBBON_SPEED_M_S = 2;

export interface RibbonDesign {
    text: string;
    color: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Null for a venue without a ribbon, or a malformed one. */
export const ribbonDesign = (venue: VenueDesign | null | undefined): RibbonDesign | null => {
    const ribbon = venue?.ribbon;
    if (!ribbon || typeof ribbon.text !== 'string' || typeof ribbon.color !== 'string' || !HEX.test(ribbon.color)) {
        return null;
    }
    return { text: ribbon.text.slice(0, RIBBON_TEXT_MAX), color: ribbon.color };
};

/** Where the band sits: metres outside the bowl's inner edge, and its bottom and top heights. */
export const ribbonBand = (decks: Deck[]): { offset: number; bottom: number; top: number } => {
    const [lower, upper] = decks;
    if (upper) {
        return { offset: upper.startOffset, bottom: upper.startHeight - 1.5, top: upper.startHeight - 0.3 };
    }
    const lowerTop = lower.startHeight + lower.rows * lower.rise;
    return { offset: lower.startOffset + lower.rows * lower.tread, bottom: lowerTop + 0.3, top: lowerTop + 1.5 };
};

export const ribbonTexture = (ribbon: RibbonDesign): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
        context.fillStyle = SCENE_COLOURS.ledBackground;
        context.fillRect(0, 0, 1024, 64);
        context.fillStyle = ribbon.color;
        context.font = '800 40px Inter, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(ribbon.text, 512, 32, 960);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    return texture;
};

// One quad per bowl segment, facing the court. u follows the arc length, in
// a whole number of tiles, so the seam where the ring closes doesn't show.
export const buildRibbon = (decks: Deck[], ribbon: RibbonDesign): Mesh => {
    const band = ribbonBand(decks);
    const points = Array.from({ length: SEGMENTS + 1 }, (_, k) => bowlRingPoint((k / SEGMENTS) * Math.PI * 2, band.offset));
    const lengths = [0];
    for (let k = 1; k <= SEGMENTS; k++) {
        const [x0, z0] = points[k - 1];
        const [x1, z1] = points[k];
        lengths.push(lengths[k - 1] + Math.hypot(x1 - x0, z1 - z0));
    }
    const perimeter = lengths[SEGMENTS];
    const repeats = Math.max(1, Math.round(perimeter / RIBBON_TILE_M));
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let k = 0; k < SEGMENTS; k++) {
        const [x0, z0] = points[k];
        const [x1, z1] = points[k + 1];
        const u0 = (lengths[k] / perimeter) * repeats;
        const u1 = (lengths[k + 1] / perimeter) * repeats;
        const corners = [
            [x0, band.bottom, z0, u0, 0],
            [x1, band.bottom, z1, u1, 0],
            [x1, band.top, z1, u1, 1],
            [x0, band.top, z0, u0, 1],
        ];
        for (const i of [0, 1, 2, 0, 2, 3]) {
            const [x, y, z, u, v] = corners[i];
            positions.push(x, y, z);
            uvs.push(u, v);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    // A lit screen, like the scoreboard's: no shading, no fog.
    const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({ map: ribbonTexture(ribbon), fog: false, side: FrontSide }),
    );
    mesh.name = 'ribbon';
    return mesh;
};

/** Moves the text along the ribbon; offset stays in [0, 1). */
export const scrollRibbon = (texture: Texture, seconds: number): void => {
    texture.offset.x = (texture.offset.x + (seconds * RIBBON_SPEED_M_S) / RIBBON_TILE_M) % 1;
};

export const ribbonTextureIn = (root: Object3D | null): Texture | null => {
    const mesh = root?.getObjectByName('ribbon');
    return mesh instanceof Mesh ? ((mesh.material as MeshBasicMaterial).map ?? null) : null;
};
