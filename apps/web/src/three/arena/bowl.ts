import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshStandardMaterial } from 'three';
import { DEFAULT_CAPACITY, defaultUpperDeck } from '@/utils/venue';
import { COURT_DEPTH_M, COURT_LENGTH_M } from './court';
import { seatMix, type SeatColouring } from './seats';

export interface Deck {
    rows: number;
    startOffset: number; // metres outside the bowl's inner edge
    startHeight: number; // metres above the floor
    tread: number; // depth of one row
    rise: number; // height of one row
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Bigger arenas get more rows, and an upper deck once a single deck would
// have to climb too far. The numbers are a look, not an attendance model.
// A venue's upper-deck setting overrides that rule either way (#295).
export const bowlLayout = (capacity: number | null, upperDeck?: boolean): Deck[] => {
    const seats = capacity ?? DEFAULT_CAPACITY;
    const lower: Deck = {
        rows: clamp(Math.round(seats / 1000), 12, 24),
        startOffset: 1,
        startHeight: 0,
        tread: 0.85,
        rise: 0.42,
    };
    if (!(upperDeck ?? defaultUpperDeck(capacity))) return [lower];
    return [
        lower,
        {
            rows: clamp(Math.round((seats - 12000) / 600), 6, 16),
            startOffset: lower.startOffset + lower.rows * lower.tread + 1.5,
            startHeight: lower.startHeight + lower.rows * lower.rise + 2.4,
            tread: 0.8,
            rise: 0.56,
        },
    ];
};

// 72, not 96: two custom staff in their worst looks cost ~1.2k triangles over
// the scene budget, and this saves ~3.5k (#294). A multiple of 4 keeps the
// superellipse's axis points exact.
const SEGMENTS = 72;
// The bowl's inner edge sits this far outside the court's apron.
const BOWL_INSET_M = 2.5;

// A superellipse: a rectangle with generously rounded corners.
const ringPoint = (t: number, ax: number, az: number): [number, number] => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [ax * Math.sign(c) * Math.sqrt(Math.abs(c)), az * Math.sign(s) * Math.sqrt(Math.abs(s))];
};

// Each row is a riser (the seat colour) and a tread (a darker aisle floor),
// all in one vertex-coloured mesh: one draw call for the whole bowl. The seat
// pattern only changes the risers' colours, so it adds no triangles.
export const buildBowl = (decks: Deck[], seats: SeatColouring): Mesh => {
    const ax = COURT_LENGTH_M / 2 + BOWL_INSET_M;
    const az = COURT_DEPTH_M / 2 + BOWL_INSET_M;
    const primary = new Color(seats.primary);
    const secondary = new Color(seats.secondary);
    const rows = decks.reduce((total, deck) => total + deck.rows, 0);
    const riser = new Color();
    const tread = new Color();
    const positions: number[] = [];
    const colours: number[] = [];
    const quad = (corners: number[][], colour: Color) => {
        for (const i of [0, 1, 2, 0, 2, 3]) {
            positions.push(...corners[i]);
            colours.push(colour.r, colour.g, colour.b);
        }
    };
    let row = 0;
    for (const deck of decks) {
        for (let r = 0; r < deck.rows; r++, row++) {
            const inner = deck.startOffset + r * deck.tread;
            const outer = inner + deck.tread;
            const y = deck.startHeight + r * deck.rise;
            const top = y + deck.rise;
            for (let k = 0; k < SEGMENTS; k++) {
                const t0 = (k / SEGMENTS) * Math.PI * 2;
                const t1 = ((k + 1) / SEGMENTS) * Math.PI * 2;
                const [ix0, iz0] = ringPoint(t0, ax + inner, az + inner);
                const [ix1, iz1] = ringPoint(t1, ax + inner, az + inner);
                const [ox0, oz0] = ringPoint(t0, ax + outer, az + outer);
                const [ox1, oz1] = ringPoint(t1, ax + outer, az + outer);
                riser.copy(primary).lerp(secondary, seatMix(seats.pattern, { row, rows, segment: k }));
                tread.copy(riser).multiplyScalar(0.45);
                quad([[ix0, y, iz0], [ix1, y, iz1], [ix1, top, iz1], [ix0, top, iz0]], riser);
                quad([[ix0, top, iz0], [ix1, top, iz1], [ox1, top, oz1], [ox0, top, oz0]], tread);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide }));
    mesh.name = 'bowl';
    return mesh;
};
