import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Ray, Vector3 } from 'three';
import type { VenueDesign } from '@/constants/venue';
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
const ASPECTS = [2, 16 / 9, 1.43, 0.625];
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
