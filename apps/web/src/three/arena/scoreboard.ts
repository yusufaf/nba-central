import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    SRGBColorSpace,
} from 'three';
import { SCOREBOARD_TEXT_MAX, type VenueDesign } from '@/constants/venue';
import { SCENE_COLOURS } from './palette';

// The centre-hung scoreboard (#296). Square in plan, so its four screens are
// equal 2:1 panels; its bottom clears the team-photo shot's frame.
export const SCOREBOARD_SIZE = { width: 6, height: 3, bottom: 8 };

export interface ScoreboardDesign {
    text: string;
    accent: string;
}

const HEX = /^#[0-9a-f]{6}$/i;
const SCREEN_PROUD_M = 0.02;

/** Null for a venue without a scoreboard, or a malformed one. */
export const scoreboardDesign = (venue: VenueDesign | null | undefined): ScoreboardDesign | null => {
    const board = venue?.scoreboard;
    if (!board || typeof board.text !== 'string' || typeof board.accent !== 'string' || !HEX.test(board.accent)) {
        return null;
    }
    return { text: board.text.slice(0, SCOREBOARD_TEXT_MAX), accent: board.accent };
};

// Accent bars top and bottom, the text in white between them, so any accent
// stays readable.
export const scoreboardTexture = (board: ScoreboardDesign): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
        context.fillStyle = SCENE_COLOURS.ledBackground;
        context.fillRect(0, 0, 512, 256);
        context.fillStyle = board.accent;
        context.fillRect(0, 0, 512, 32);
        context.fillRect(0, 224, 512, 32);
        context.fillStyle = SCENE_COLOURS.scoreboardText;
        context.font = '800 120px Inter, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(board.text, 256, 128, 472);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

// Four outward-facing quads just proud of the housing's sides, each showing
// the whole texture left to right as seen from outside.
const screensGeometry = (): BufferGeometry => {
    const half = SCOREBOARD_SIZE.width / 2;
    const out = half + SCREEN_PROUD_M;
    const bottom = SCOREBOARD_SIZE.bottom;
    const top = bottom + SCOREBOARD_SIZE.height;
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let side = 0; side < 4; side++) {
        const angle = (side * Math.PI) / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        // The +z screen, turned about y: (x, z) -> (x cos + z sin, -x sin + z cos).
        const corner = (x: number, y: number): number[] => [x * cos + out * sin, y, -x * sin + out * cos];
        const quad = [corner(-half, bottom), corner(half, bottom), corner(half, top), corner(-half, top)];
        const quadUvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (const i of [0, 1, 2, 0, 2, 3]) {
            positions.push(...quad[i]);
            uvs.push(...quadUvs[i]);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    return geometry;
};

// Two meshes, 20 triangles: the housing box and the four screens.
export const buildScoreboard = (board: ScoreboardDesign): Group => {
    const { width, height, bottom } = SCOREBOARD_SIZE;
    const group = new Group();
    group.name = 'scoreboard';
    const housing = new Mesh(
        new BoxGeometry(width, height, width),
        new MeshStandardMaterial({ color: SCENE_COLOURS.scoreboardHousing, roughness: 0.6 }),
    );
    housing.position.y = bottom + height / 2;
    // Lit screens: no shading, and no fog, which would grey them from the far seats.
    const screens = new Mesh(screensGeometry(), new MeshBasicMaterial({ map: scoreboardTexture(board), fog: false }));
    screens.name = 'scoreboard-screens';
    group.add(housing, screens);
    return group;
};
