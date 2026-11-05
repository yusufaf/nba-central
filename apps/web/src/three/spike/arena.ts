// Throwaway spike (#119). A procedural arena around the team's 2D court:
// floor from the rasterised CourtFloor SVG, a stepped two-deck bowl with
// vertex-coloured seat sections, a centre-hung scoreboard, an LED ribbon
// and rafters banners. Everything is generated; nothing is loaded.
import {
    AmbientLight,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    CircleGeometry,
    Color,
    DirectionalLight,
    DoubleSide,
    Group,
    HemisphereLight,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PlaneGeometry,
    RepeatWrapping,
    SRGBColorSpace,
    SpotLight,
    type Texture,
    type WebGLRenderer,
} from 'three';

// The SVG court is 104 x 58 ft including its apron band.
export const COURT_LENGTH = 104 * 0.3048;
export const COURT_DEPTH = 58 * 0.3048;

export type SeatPattern = 'solid' | 'sections' | 'rows' | 'gradient';
export type Lighting = 'broadcast' | 'theater';

export interface Venue {
    seatPrimary: string;
    seatSecondary: string;
    pattern: SeatPattern;
    upperDeck: boolean;
    scoreboardText: string;
    ribbonText: string;
    banners: { title: string; subtitle: string; colour: string }[];
    lighting: Lighting;
    tint: string;
}

const canvasTexture = (width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d')!);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

// A superellipse ring: a rectangle with generously rounded corners.
const ringPoint = (t: number, ax: number, az: number): [number, number] => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const e = 2 / 4;
    return [ax * Math.sign(c) * Math.pow(Math.abs(c), e), az * Math.sign(s) * Math.pow(Math.abs(s), e)];
};

const SEGMENTS = 96;
const SECTIONS = 16;

const seatColour = (venue: Venue, row: number, rows: number, segment: number): Color => {
    const a = new Color(venue.seatPrimary);
    const b = new Color(venue.seatSecondary);
    switch (venue.pattern) {
        case 'sections':
            return Math.floor((segment / SEGMENTS) * SECTIONS) % 2 === 0 ? a : b;
        case 'rows':
            return row % 2 === 0 ? a : b;
        case 'gradient':
            return a.clone().lerp(b, row / Math.max(1, rows - 1));
        default:
            return a;
    }
};

interface Deck {
    rows: number;
    startOffset: number;
    startHeight: number;
    tread: number;
    rise: number;
}

// Treads and risers for every row, one colour per seat section.
const buildDeck = (venue: Venue, deck: Deck, ax: number, az: number, shade: number) => {
    const positions: number[] = [];
    const colours: number[] = [];
    const push = (x: number, y: number, z: number, colour: Color) => {
        positions.push(x, y, z);
        colours.push(colour.r * shade, colour.g * shade, colour.b * shade);
    };
    const quad = (p: number[][], colour: Color) => {
        for (const i of [0, 1, 2, 0, 2, 3]) push(p[i][0], p[i][1], p[i][2], colour);
    };
    for (let r = 0; r < deck.rows; r++) {
        const inner = deck.startOffset + r * deck.tread;
        const outer = inner + deck.tread;
        const y = deck.startHeight + r * deck.rise;
        for (let k = 0; k < SEGMENTS; k++) {
            const t0 = (k / SEGMENTS) * Math.PI * 2;
            const t1 = ((k + 1) / SEGMENTS) * Math.PI * 2;
            const [ix0, iz0] = ringPoint(t0, ax + inner, az + inner);
            const [ix1, iz1] = ringPoint(t1, ax + inner, az + inner);
            const [ox0, oz0] = ringPoint(t0, ax + outer, az + outer);
            const [ox1, oz1] = ringPoint(t1, ax + outer, az + outer);
            const seat = seatColour(venue, r, deck.rows, k);
            // The riser carries the seat colour; the tread is the aisle floor.
            quad([[ix0, y, iz0], [ix1, y, iz1], [ix1, y + deck.rise, iz1], [ix0, y + deck.rise, iz0]], seat);
            const floor = seat.clone().multiplyScalar(0.45);
            quad([[ix0, y + deck.rise, iz0], [ix1, y + deck.rise, iz1], [ox1, y + deck.rise, oz1], [ox0, y + deck.rise, oz0]], floor);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    return new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide }));
};

// A vertical band around the bowl between the decks, its text scrolling.
const buildRibbon = (venue: Venue, ax: number, az: number, y: number) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    let perimeter = 0;
    const points = Array.from({ length: SEGMENTS + 1 }, (_, k) => ringPoint((k / SEGMENTS) * Math.PI * 2, ax, az));
    for (let k = 0; k < SEGMENTS; k++) perimeter += Math.hypot(points[k + 1][0] - points[k][0], points[k + 1][1] - points[k][1]);
    let travelled = 0;
    for (let k = 0; k < SEGMENTS; k++) {
        const [x0, z0] = points[k];
        const [x1, z1] = points[k + 1];
        const step = Math.hypot(x1 - x0, z1 - z0);
        const u0 = travelled / perimeter;
        const u1 = (travelled + step) / perimeter;
        travelled += step;
        const height = 1.1;
        positions.push(x0, y, z0, x1, y, z1, x1, y + height, z1, x0, y, z0, x1, y + height, z1, x0, y + height, z0);
        uvs.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    const texture = canvasTexture(1024, 64, (ctx) => {
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, 1024, 64);
        ctx.fillStyle = venue.tint;
        ctx.font = '700 40px Inter, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${venue.ribbonText.toUpperCase()}  •  `, 8, 34);
        ctx.fillText(`${venue.ribbonText.toUpperCase()}  •  `, 520, 34);
    });
    texture.wrapS = RepeatWrapping;
    texture.repeat.x = Math.max(1, Math.round(perimeter / 18));
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ map: texture, side: DoubleSide, toneMapped: false }));
    return { mesh, texture };
};

const buildScoreboard = (venue: Venue) => {
    const face = canvasTexture(512, 320, (ctx) => {
        ctx.fillStyle = '#07090c';
        ctx.fillRect(0, 0, 512, 320);
        ctx.fillStyle = venue.tint;
        ctx.fillRect(0, 0, 512, 12);
        ctx.fillRect(0, 308, 512, 12);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = '800 64px Inter, sans-serif';
        ctx.fillText(venue.scoreboardText.toUpperCase().slice(0, 16), 256, 110, 480);
        ctx.font = '800 96px Inter, sans-serif';
        ctx.fillStyle = venue.tint;
        ctx.fillText('0  :  0', 256, 230);
    });
    const side = new MeshBasicMaterial({ map: face, toneMapped: false });
    const cap = new MeshStandardMaterial({ color: '#111418', roughness: 0.6 });
    return new Mesh(new BoxGeometry(5, 3, 5), [side, side, cap, cap, side, side]);
};

const buildBanner = (banner: Venue['banners'][number]) => {
    const texture = canvasTexture(256, 400, (ctx) => {
        ctx.fillStyle = banner.colour;
        ctx.fillRect(0, 0, 256, 400);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = '800 40px Inter, sans-serif';
        ctx.fillText(banner.title.toUpperCase().slice(0, 16), 128, 120, 230);
        ctx.font = '600 26px Inter, sans-serif';
        ctx.fillText(banner.subtitle.toUpperCase().slice(0, 24), 128, 180, 230);
        ctx.beginPath();
        ctx.moveTo(0, 400);
        ctx.lineTo(128, 340);
        ctx.lineTo(256, 400);
        ctx.fillStyle = '#05070a';
        ctx.fill();
    });
    return new Mesh(new PlaneGeometry(2, 3.1), new MeshBasicMaterial({ map: texture, side: DoubleSide }));
};

// A soft dark disc under each figure; far cheaper than a shadow map.
export const blobShadow = (radius: number) => {
    const texture = canvasTexture(128, 128, (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0, 'rgba(0,0,0,0.55)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
    });
    const mesh = new Mesh(
        new CircleGeometry(radius, 24),
        new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.005;
    return mesh;
};

export interface BuiltArena {
    group: Group;
    tick: (seconds: number) => void;
}

export const buildArena = (venue: Venue, courtTexture: Texture | null, renderer: WebGLRenderer): BuiltArena => {
    const group = new Group();
    const ax = COURT_LENGTH / 2 + 2.5;
    const az = COURT_DEPTH / 2 + 2.5;

    const surround = new Mesh(
        new PlaneGeometry(ax * 2 + 6, az * 2 + 6),
        new MeshStandardMaterial({ color: '#1a1d22', roughness: 0.95 }),
    );
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.01;
    group.add(surround);

    if (courtTexture) {
        courtTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        courtTexture.colorSpace = SRGBColorSpace;
    }
    const floor = new Mesh(
        new PlaneGeometry(COURT_LENGTH, COURT_DEPTH),
        new MeshStandardMaterial({ map: courtTexture, color: courtTexture ? '#ffffff' : '#c99a5b', roughness: 0.38 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    const lower: Deck = { rows: 20, startOffset: 1, startHeight: 0, tread: 0.85, rise: 0.42 };
    const lowerTop = lower.startHeight + lower.rows * lower.rise;
    const lowerOuter = lower.startOffset + lower.rows * lower.tread;
    const shade = venue.lighting === 'theater' ? 0.55 : 1;
    group.add(buildDeck(venue, lower, ax, az, shade));
    const ribbon = buildRibbon(venue, ax + lowerOuter, az + lowerOuter, lowerTop);
    group.add(ribbon.mesh);
    if (venue.upperDeck) {
        const upper: Deck = { rows: 14, startOffset: lowerOuter + 1.5, startHeight: lowerTop + 2.4, tread: 0.8, rise: 0.56 };
        group.add(buildDeck(venue, upper, ax, az, shade * 0.9));
    }

    const scoreboard = buildScoreboard(venue);
    scoreboard.position.set(0, 14, 0);
    group.add(scoreboard);

    venue.banners.slice(0, 8).forEach((banner, i, all) => {
        const mesh = buildBanner(banner);
        mesh.position.set((i - (all.length - 1) / 2) * 2.6, 17, -(az + 8));
        group.add(mesh);
    });

    if (venue.lighting === 'broadcast') {
        group.add(new HemisphereLight('#ffffff', '#30261c', 1.6));
        const key = new DirectionalLight('#ffffff', 2.2);
        key.position.set(4, 20, 12);
        group.add(key);
    } else {
        group.add(new AmbientLight('#ffffff', 0.18));
        const spot = new SpotLight(venue.tint, 900, 60, Math.PI / 5, 0.55, 1.6);
        spot.position.set(0, 26, 4);
        spot.target.position.set(0, 0, 0);
        group.add(spot, spot.target);
        const fill = new DirectionalLight('#ffffff', 0.6);
        fill.position.set(0, 6, 14);
        group.add(fill);
    }

    let scroll = 0;
    return {
        group,
        tick: (seconds: number) => {
            scroll = (scroll + seconds * 0.02) % 1;
            ribbon.texture.offset.x = scroll;
        },
    };
};
