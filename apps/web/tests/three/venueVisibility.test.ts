import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Ray, Vector3 } from 'three';
import { BANNER_SUBTITLE_MAX, BANNER_TITLE_MAX, type VenueDesign } from '@/constants/venue';
import { BANNER_FONT, BANNER_ROW, bannerLayout, bannerLines, lineChars } from '@/three/arena/banners';
import { bowlLayout, bowlRingPoint } from '@/three/arena/bowl';
import { ribbonBand } from '@/three/arena/ribbon';
import { framePreset, type CameraPreset } from '@/three/scene/cameraPresets';
import { buildSeating } from '@/three/scene/stage';

// #296's acceptance test: the scoreboard and the ribbon are in view from the
// broadcast and rafters shots, for every bowl a custom arena can have, and
// the board never hides the team.

const venueWith = (upperDeck: boolean): VenueDesign => ({
    version: 1,
    seats: { primary: '#2a3140', secondary: '#b91c1c', pattern: 'sections' },
    upperDeck,
    scoreboard: { text: 'HARBOR', accent: '#ef4444' },
    ribbon: { text: 'WELCOME TO HARBOR PAVILION', color: '#f59e0b' },
});

const BOWLS = [
    { capacity: null, upperDeck: true },
    { capacity: 1, upperDeck: false },
    { capacity: 1, upperDeck: true },
    { capacity: 12000, upperDeck: false },
    { capacity: 12000, upperDeck: true },
    { capacity: 200000, upperDeck: false },
    { capacity: 200000, upperDeck: true },
];
// 0.586 is a 360 x 800 phone's public viewport (#297).
const ASPECTS = [2, 16 / 9, 1.43, 0.625, 0.586];
const PRESETS: CameraPreset[] = ['broadcast', 'rafters'];

const cameraFor = (preset: CameraPreset, aspect: number): PerspectiveCamera => {
    const frame = framePreset(preset, aspect);
    const camera = new PerspectiveCamera(frame.fov, aspect, 0.1, 200);
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
    camera.updateMatrixWorld();
    return camera;
};

const inView = (point: Vector3, camera: PerspectiveCamera, edge = 1): boolean => {
    const ndc = point.clone().project(camera);
    return Math.abs(ndc.x) <= edge && Math.abs(ndc.y) <= edge && ndc.z < 1 && ndc.z > -1;
};

const hiddenBy = (box: Box3, point: Vector3, camera: PerspectiveCamera): boolean => {
    const toPoint = point.clone().sub(camera.position);
    const hit = new Ray(camera.position.clone(), toPoint.clone().normalize()).intersectBox(box, new Vector3());
    return hit !== null && hit.distanceTo(camera.position) < toPoint.length();
};

const corners = (box: Box3): Vector3[] =>
    [0, 1, 2, 3, 4, 5, 6, 7].map(
        (i) =>
            new Vector3(
                i & 1 ? box.max.x : box.min.x,
                i & 2 ? box.max.y : box.min.y,
                i & 4 ? box.max.z : box.min.z,
            ),
    );

const TEAM = [-4.9, 4.9].flatMap((x) => [0, 2].map((y) => new Vector3(x, y, 0)));

describe('the scoreboard and ribbon from broadcast and rafters', () => {
    for (const { capacity, upperDeck } of BOWLS) {
        const seating = buildSeating(capacity, venueWith(upperDeck));
        seating.updateMatrixWorld(true);
        const board = new Box3().setFromObject(seating.getObjectByName('scoreboard')!);
        const band = ribbonBand(bowlLayout(capacity, upperDeck));
        const ribbonLine = Array.from({ length: 360 }, (_, k) => {
            const [x, z] = bowlRingPoint((k / 360) * Math.PI * 2, band.offset);
            return new Vector3(x, (band.bottom + band.top) / 2, z);
        });

        for (const preset of PRESETS) {
            for (const aspect of ASPECTS) {
                it(`${preset}, capacity ${capacity}, upper deck ${upperDeck}, aspect ${aspect.toFixed(2)}`, () => {
                    const camera = cameraFor(preset, aspect);
                    for (const corner of corners(board)) expect(inView(corner, camera)).toBe(true);
                    const visible = ribbonLine.filter(
                        (point) => inView(point, camera, 0.95) && !hiddenBy(board, point, camera),
                    );
                    expect(visible.length).toBeGreaterThanOrEqual(6);
                    expect(hiddenBy(board, new Vector3(0, 1, 0), camera)).toBe(false);
                    for (const point of TEAM) expect(inView(point, camera)).toBe(true);
                });
            }
        }
    }
});

describe('the team-photo shot', () => {
    it('never shows the scoreboard, so the share card stays as it was', () => {
        const seating = buildSeating(18000, venueWith(true));
        seating.updateMatrixWorld(true);
        const board = new Box3().setFromObject(seating.getObjectByName('scoreboard')!);
        for (const aspect of [16 / 9, 0.625]) {
            const camera = cameraFor('team', aspect);
            for (const corner of corners(board)) expect(inView(corner, camera)).toBe(false);
        }
    });
});

// #297: every banner, for any count, is in view and clear of the scoreboard
// from both shots, and the banners never hide the whole ribbon.
const bannerRow = (count: number): { corners: Vector3[]; centre: Vector3; box: Box3 }[] =>
    bannerLayout(count).map(({ x, width, height }) => {
        const { z, top } = BANNER_ROW;
        const bottom = top - height;
        const left = x - width / 2;
        const right = x + width / 2;
        return {
            corners: [
                new Vector3(left, bottom, z),
                new Vector3(right, bottom, z),
                new Vector3(right, top, z),
                new Vector3(left, top, z),
            ],
            centre: new Vector3(x, (top + bottom) / 2, z),
            box: new Box3(new Vector3(left, bottom, z - 0.01), new Vector3(right, top, z + 0.01)),
        };
    });

const BANNER_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('the banners from broadcast and rafters', () => {
    for (const { capacity, upperDeck } of BOWLS) {
        const seating = buildSeating(capacity, venueWith(upperDeck));
        seating.updateMatrixWorld(true);
        const board = new Box3().setFromObject(seating.getObjectByName('scoreboard')!);
        const band = ribbonBand(bowlLayout(capacity, upperDeck));
        const ribbonLine = Array.from({ length: 360 }, (_, k) => {
            const [x, z] = bowlRingPoint((k / 360) * Math.PI * 2, band.offset);
            return new Vector3(x, (band.bottom + band.top) / 2, z);
        });

        for (const preset of PRESETS) {
            for (const aspect of ASPECTS) {
                it(`${preset}, capacity ${capacity}, upper deck ${upperDeck}, aspect ${aspect.toFixed(3)}`, () => {
                    const camera = cameraFor(preset, aspect);
                    for (const count of BANNER_COUNTS) {
                        const row = bannerRow(count);
                        for (const banner of row) {
                            for (const point of [...banner.corners, banner.centre]) {
                                expect(inView(point, camera, 0.95), `${count} banners`).toBe(true);
                                expect(hiddenBy(board, point, camera), `${count} banners`).toBe(false);
                            }
                        }
                        const occluders = [board, ...row.map((banner) => banner.box)];
                        const visible = ribbonLine.filter(
                            (point) =>
                                inView(point, camera, 0.95) && !occluders.some((box) => hiddenBy(box, point, camera)),
                        );
                        expect(visible.length, `${count} banners`).toBeGreaterThanOrEqual(6);
                    }
                });
            }
        }
    }
});

// The arena editor's preview: about 848 px wide and min(32dvh, 15rem) tall, on
// a narrower sheet, then desktop, 600 px and 500 px tall windows.
const EDITOR_ASPECTS = [2.5, 848 / 240, 848 / 192, 848 / 160];

describe('the banners shot (#322)', () => {
    for (const { capacity, upperDeck } of BOWLS) {
        const seating = buildSeating(capacity, venueWith(upperDeck));
        seating.updateMatrixWorld(true);
        const board = new Box3().setFromObject(seating.getObjectByName('scoreboard')!);
        const decks = bowlLayout(capacity, upperDeck);

        for (const aspect of [...ASPECTS, ...EDITOR_ASPECTS]) {
            it(`capacity ${capacity}, upper deck ${upperDeck}, aspect ${aspect.toFixed(3)}`, () => {
                const camera = cameraFor('banners', aspect);
                for (const count of BANNER_COUNTS) {
                    for (const banner of bannerRow(count)) {
                        for (const point of [...banner.corners, banner.centre]) {
                            expect(inView(point, camera, 0.95), `${count} banners`).toBe(true);
                            expect(hiddenBy(board, point, camera), `${count} banners`).toBe(false);
                        }
                    }
                }
                // Wherever the camera hangs over a deck, it is above that deck's top row.
                for (const deck of decks) {
                    const inner = bowlRingPoint(Math.PI / 2, deck.startOffset)[1];
                    const outer = bowlRingPoint(Math.PI / 2, deck.startOffset + deck.rows * deck.tread)[1];
                    if (camera.position.z >= inner && camera.position.z <= outer) {
                        expect(camera.position.y).toBeGreaterThan(deck.startHeight + deck.rows * deck.rise);
                    }
                }
            });
        }
    }
});

describe('the team-photo shot and the banners', () => {
    it('never shows a banner, so the share card stays as it was', () => {
        for (const aspect of [1200 / 630, 16 / 9, 0.625]) {
            const camera = cameraFor('team', aspect);
            for (const count of BANNER_COUNTS) {
                for (const banner of bannerRow(count)) {
                    for (const corner of banner.corners) expect(inView(corner, camera)).toBe(false);
                }
            }
        }
    });
});

// The legibility bar the owner accepted (#297): text at least 10 px on screen.
// A line of `chars` characters is drawn at its cap, or smaller to fit the
// 216 px box of a 256 px cell; B is the narrowest banner's on-screen width.
const CHAR_EM = 0.62;
const linePx = (bannerPx: number, cap: number, chars: number): number =>
    (Math.min(cap, BANNER_FONT.textWidth / (chars * CHAR_EM)) * bannerPx) / 256;

const narrowestBannerPx = (preset: CameraPreset, count: number, width: number, height: number): number => {
    const camera = cameraFor(preset, width / height);
    return Math.min(
        ...bannerRow(count).flatMap(({ corners: [bottomLeft, bottomRight, topRight, topLeft] }) =>
            [
                [bottomLeft, bottomRight],
                [topLeft, topRight],
            ].map(([left, right]) => ((right.clone().project(camera).x - left.clone().project(camera).x) / 2) * width),
        ),
    );
};

describe('banner legibility', () => {
    it('fits a 4-character title at its cap', () => {
        expect(4 * CHAR_EM * BANNER_FONT.title).toBeLessThanOrEqual(BANNER_FONT.textWidth);
    });

    it('on a 1200 x 630 canvas (a desktop window at least 900 px tall)', () => {
        for (const preset of PRESETS) {
            expect(linePx(narrowestBannerPx(preset, 8, 1200, 630), BANNER_FONT.title, 4), preset).toBeGreaterThanOrEqual(10);
        }
        expect(linePx(narrowestBannerPx('broadcast', 8, 1200, 630), BANNER_FONT.title, 6)).toBeGreaterThanOrEqual(10);
        const five = narrowestBannerPx('broadcast', 5, 1200, 630);
        expect(linePx(five, BANNER_FONT.title, 10)).toBeGreaterThanOrEqual(10);
        expect((BANNER_FONT.subtitle * five) / 256).toBeGreaterThanOrEqual(10);
    });

    it('on a 1376 x 517 canvas (a 1536 x 864 window)', () => {
        for (const preset of PRESETS) {
            expect(linePx(narrowestBannerPx(preset, 8, 1376, 517), BANNER_FONT.title, 4), preset).toBeGreaterThanOrEqual(10);
        }
        expect(linePx(narrowestBannerPx('broadcast', 5, 1376, 517), BANNER_FONT.title, 6)).toBeGreaterThanOrEqual(10);
    });

    // An unbroken 16-character title, and subtitle lines up to 16 characters:
    // a 24-character subtitle reads once it is split onto two lines.
    it('from the banners shot, full titles and subtitles at eight banners (#322)', () => {
        for (const [width, height] of [
            [1200, 630],
            [1376, 517],
        ]) {
            const px = narrowestBannerPx('banners', 8, width, height);
            expect(linePx(px, BANNER_FONT.title, BANNER_TITLE_MAX), `${width}x${height} title`).toBeGreaterThanOrEqual(10);
            expect(linePx(px, BANNER_FONT.subtitle, 16), `${width}x${height} subtitle line`).toBeGreaterThanOrEqual(10);
        }
        const subtitle = 'NBA WORLD CHAMPIONS 1998';
        expect(subtitle).toHaveLength(BANNER_SUBTITLE_MAX);
        const longest = Math.max(...bannerLines(subtitle, lineChars(BANNER_FONT.subtitle)).map((line) => line.length));
        expect(linePx(narrowestBannerPx('banners', 8, 1200, 630), BANNER_FONT.subtitle, longest)).toBeGreaterThanOrEqual(10);
    });
});
