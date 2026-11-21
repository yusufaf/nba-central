import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeshBasicMaterial, Vector3, type Mesh } from 'three';
import type { VenueBanner } from '@/constants/venue';
import {
    BANNER_FONT,
    BANNER_ROW,
    bannerAtlas,
    bannerLayout,
    bannerLines,
    bannersDesign,
    bannerTextColour,
    buildBanners,
    lineChars,
} from '@/three/arena/banners';

const BANNER: VenueBanner = { kind: 'title', title: 'CHAMPIONS', subtitle: '1998', color: '#1d2a44' };
const RETIRED: VenueBanner = { kind: 'number', title: '23', subtitle: 'JORDAN', color: '#c9a227' };

const CHAR_EM = 0.62;
const pxOf = (font: string): number => Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 0);

// A 2D context that records what it's asked to draw. Text is measured as
// CHAR_EM per character at the current font size.
const spyContext = () => {
    const calls: { fillRect: unknown[][]; fillText: { args: unknown[]; font: string }[]; fonts: string[] } = {
        fillRect: [],
        fillText: [],
        fonts: [],
    };
    let fillStyle = '';
    const context = {
        set fillStyle(value: string) {
            fillStyle = value;
        },
        get fillStyle() {
            return fillStyle;
        },
        set font(value: string) {
            calls.fonts.push(value);
        },
        get font() {
            return calls.fonts.at(-1) ?? '';
        },
        fillRect: (...args: unknown[]) => calls.fillRect.push([fillStyle, ...args]),
        fillText: (...args: unknown[]) => calls.fillText.push({ args, font: calls.fonts.at(-1) ?? '' }),
        measureText: (text: string) => ({ width: text.length * CHAR_EM * pxOf(calls.fonts.at(-1) ?? '') }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        new Proxy(context, {
            get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}),
            set: (target, key, value) => {
                (target as Record<string | symbol, unknown>)[key] = value;
                return true;
            },
        }) as unknown as CanvasRenderingContext2D,
    );
    return calls;
};

describe('bannersDesign', () => {
    it('is empty without banners or with a malformed list', () => {
        expect(bannersDesign(null)).toEqual([]);
        expect(bannersDesign({ version: 1 })).toEqual([]);
        expect(bannersDesign({ version: 1, banners: 'x' } as never)).toEqual([]);
    });

    it('drops malformed banners and keeps the rest in order', () => {
        const banners = [
            BANNER,
            { ...BANNER, kind: 'flag' },
            { ...BANNER, title: 7 },
            { ...BANNER, color: 'gold' },
            null,
            RETIRED,
        ];
        expect(bannersDesign({ version: 1, banners } as never)).toEqual([BANNER, RETIRED]);
    });

    it('cuts the texts to their limits and the list to 8', () => {
        const long = { ...BANNER, title: 'x'.repeat(20), subtitle: 'y'.repeat(30) };
        const design = bannersDesign({ version: 1, banners: Array.from({ length: 10 }, () => long) });
        expect(design).toHaveLength(8);
        expect(design[0]).toEqual({ ...BANNER, title: 'x'.repeat(16), subtitle: 'y'.repeat(24) });
    });
});

describe('bannerLayout', () => {
    it('hangs one banner at full size in the middle', () => {
        expect(bannerLayout(1)).toEqual([{ x: 0, width: 3.5, height: 4.375 }]);
    });

    it('keeps full size up to five banners', () => {
        for (const slot of bannerLayout(5)) expect(slot.width).toBe(3.5);
    });

    it('fits eight across the span, gapped', () => {
        const slots = bannerLayout(8);
        for (const slot of slots) expect(slot.width).toBe(2.09375);
        expect(slots[0].x - slots[0].width / 2).toBeCloseTo(-BANNER_ROW.span / 2);
        expect(slots[7].x + slots[7].width / 2).toBeCloseTo(BANNER_ROW.span / 2);
        for (let i = 1; i < 8; i++) {
            const gap = slots[i].x - slots[i].width / 2 - (slots[i - 1].x + slots[i - 1].width / 2);
            expect(gap).toBeCloseTo(BANNER_ROW.gap);
        }
    });
});

describe('bannerLines', () => {
    it('fits about 4 title characters and 10 subtitle characters at the caps', () => {
        expect(lineChars(BANNER_FONT.title)).toBe(4);
        expect(lineChars(BANNER_FONT.subtitle)).toBe(10);
    });

    it.for([
        ['CHAMPIONS', 4, ['CHAMPIONS']],
        ['1998', 4, ['1998']],
        ['NBA CHAMPS', 4, ['NBA', 'CHAMPS']],
        ['NBA CHAMPIONS', 4, ['NBA', 'CHAMPIONS']],
        ['MICHAEL JORDAN', 4, ['MICHAEL', 'JORDAN']],
        ['ABCDEFGHIJKLMNOP', 4, ['ABCDEFGHIJKLMNOP']],
        ['  NBA   CHAMPS  ', 4, ['NBA', 'CHAMPS']],
        ['  ', 4, []],
        ['EAST 1998', 10, ['EAST 1998']],
        ['WORLD CHAMPIONS', 10, ['WORLD', 'CHAMPIONS']],
    ] as [string, number, string[]][])('%j at %i characters is %j', ([text, maxChars, lines]) => {
        expect(bannerLines(text, maxChars)).toEqual(lines);
    });
});

describe('bannerTextColour', () => {
    it('picks white or black for contrast', () => {
        expect(bannerTextColour('#1d2a44')).toBe('#ffffff');
        expect(bannerTextColour('#c9a227')).toBe('#000000');
        expect(bannerTextColour('#f5f5f4')).toBe('#000000');
    });
});

describe('bannerAtlas', () => {
    afterEach(() => vi.restoreAllMocks());

    const CELL = { width: 1024 / 4, height: 640 / 2 };

    it("fills each banner's cell with its colour", () => {
        const calls = spyContext();
        bannerAtlas([BANNER, RETIRED, BANNER, BANNER, RETIRED]);
        const fills = calls.fillRect.filter(([, , , width, height]) => width === CELL.width && height === CELL.height);
        expect(fills).toEqual([
            [BANNER.color, 0, 0, CELL.width, CELL.height],
            [RETIRED.color, 256, 0, CELL.width, CELL.height],
            [BANNER.color, 512, 0, CELL.width, CELL.height],
            [BANNER.color, 768, 0, CELL.width, CELL.height],
            [RETIRED.color, 0, 320, CELL.width, CELL.height],
        ]);
    });

    it('uses the bold Inter font string for every line, upper-cased', () => {
        const calls = spyContext();
        bannerAtlas([{ ...BANNER, title: 'Champions', subtitle: 'west 1998' }]);
        for (const font of calls.fonts) expect(font).toMatch(/^800 [\d.]+px Inter, sans-serif$/);
        expect(calls.fillText.map(({ args }) => args[0])).toEqual(['CHAMPIONS', 'WEST 1998']);
    });

    it('draws a retired number at its cap', () => {
        const calls = spyContext();
        bannerAtlas([RETIRED]);
        const number = calls.fillText.find(({ args }) => args[0] === '23');
        expect(pxOf(number!.font)).toBe(BANNER_FONT.number);
    });

    it('shrinks a long line to fit the text box rather than squeezing it', () => {
        const calls = spyContext();
        bannerAtlas([{ ...BANNER, title: 'ABCDEFGHIJKLMNOP' }]);
        const title = calls.fillText.find(({ args }) => args[0] === 'ABCDEFGHIJKLMNOP')!;
        const px = pxOf(title.font);
        expect(px).toBeLessThan(BANNER_FONT.title);
        expect(16 * CHAR_EM * px).toBeLessThanOrEqual(BANNER_FONT.textWidth + 1e-6);
        for (const { args } of calls.fillText) expect(args).toHaveLength(3);
    });

    it('keeps two-line titles and subtitles inside their cell', () => {
        const calls = spyContext();
        const tall = { ...BANNER, title: 'NBA CHAMPIONS', subtitle: 'WESTERN CONFERENCE 1998' };
        bannerAtlas([tall, tall, tall, tall, { ...tall, kind: 'number', title: '33' }]);
        expect(calls.fillText).toHaveLength(4 * 4 + 3);
        calls.fillText.forEach(({ args, font }, i) => {
            const row = i < 16 ? 0 : 1;
            const y = args[2] as number;
            const half = pxOf(font) / 2;
            expect(y - half).toBeGreaterThanOrEqual(row * CELL.height);
            expect(y + half).toBeLessThanOrEqual((row + 1) * CELL.height);
        });
    });

    it('is blank without a 2D context', () => {
        expect(bannerAtlas([BANNER]).image).toBeInstanceOf(HTMLCanvasElement);
    });
});

describe('buildBanners', () => {
    afterEach(() => vi.restoreAllMocks());

    const normals = (mesh: Mesh): Vector3[] => {
        const position = mesh.geometry.getAttribute('position');
        const out: Vector3[] = [];
        for (let i = 0; i < position.count; i += 3) {
            const [a, b, c] = [i, i + 1, i + 2].map((k) => new Vector3().fromBufferAttribute(position, k));
            out.push(b.sub(a).cross(c.sub(a)).normalize());
        }
        return out;
    };

    it('is one unlit, unfogged mesh of 4 triangles a banner', () => {
        const eight = Array.from({ length: 8 }, () => BANNER);
        const mesh = buildBanners(eight);
        expect(mesh.name).toBe('banners');
        expect(mesh.geometry.getAttribute('position').count / 3).toBe(32);
        expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
        expect((mesh.material as MeshBasicMaterial).fog).toBe(false);
        expect((mesh.material as MeshBasicMaterial).map).not.toBeNull();
    });

    it('faces the court on the front and the far seats on the back', () => {
        const mesh = buildBanners([BANNER, RETIRED]);
        const zs = normals(mesh).map((normal) => Math.sign(normal.z));
        // Per banner: two front triangles, then two back ones.
        expect(zs).toEqual([1, 1, -1, -1, 1, 1, -1, -1]);
    });

    it('hangs from the row top at the row depth', () => {
        const mesh = buildBanners([BANNER]);
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox!;
        expect(box.max.y).toBeCloseTo(BANNER_ROW.top);
        expect(box.min.y).toBeCloseTo(BANNER_ROW.top - 4.375);
        expect(box.min.z).toBeCloseTo(BANNER_ROW.z);
        expect(box.max.z).toBeCloseTo(BANNER_ROW.z);
    });

    it("maps every banner to its own atlas cell, mirrored on the back", () => {
        const mesh = buildBanners(Array.from({ length: 6 }, () => BANNER));
        const uv = mesh.geometry.getAttribute('uv');
        const position = mesh.geometry.getAttribute('position');
        for (let banner = 0; banner < 6; banner++) {
            const [u0, u1] = [(banner % 4) / 4, (banner % 4 + 1) / 4];
            const [v0, v1] = banner < 4 ? [0.5, 1] : [0, 0.5];
            const xs: number[] = [];
            for (let k = banner * 12; k < banner * 12 + 12; k++) {
                expect(uv.getX(k)).toBeGreaterThanOrEqual(u0);
                expect(uv.getX(k)).toBeLessThanOrEqual(u1);
                expect(uv.getY(k)).toBeGreaterThanOrEqual(v0);
                expect(uv.getY(k)).toBeLessThanOrEqual(v1);
                xs.push(position.getX(k));
            }
            const left = Math.min(...xs);
            const front = banner * 12;
            const back = front + 6;
            // The front's left edge shows the cell's left; the back's shows its right.
            for (const start of [front, back]) {
                for (let k = start; k < start + 6; k++) {
                    if (position.getX(k) === left) expect(uv.getX(k)).toBe(start === front ? u0 : u1);
                }
            }
        }
    });
});
