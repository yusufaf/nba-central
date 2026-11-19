import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { buildScoreboard, scoreboardDesign, scoreboardTexture, SCOREBOARD_SIZE } from '@/three/arena/scoreboard';

const BOARD = { text: 'HARBOR', accent: '#c8102e' };

const triangles = (mesh: Mesh): number => {
    const index = mesh.geometry.getIndex();
    return (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
};

const spyContext = () => {
    const calls: { fillRect: unknown[][]; fillText: unknown[][]; fillStyles: string[] } = {
        fillRect: [],
        fillText: [],
        fillStyles: [],
    };
    const context = {
        set fillStyle(value: string) {
            calls.fillStyles.push(value);
        },
        get fillStyle() {
            return calls.fillStyles.at(-1) ?? '';
        },
        fillRect: (...args: unknown[]) => calls.fillRect.push([calls.fillStyles.at(-1), ...args]),
        fillText: (...args: unknown[]) => calls.fillText.push(args),
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

describe('scoreboardDesign', () => {
    it('is null without a scoreboard or with a malformed one', () => {
        expect(scoreboardDesign(null)).toBeNull();
        expect(scoreboardDesign({ version: 1 })).toBeNull();
        expect(scoreboardDesign({ version: 1, scoreboard: { text: 1, accent: 'red' } } as never)).toBeNull();
        expect(scoreboardDesign({ version: 1, scoreboard: { text: 'OK', accent: 'red' } })).toBeNull();
    });

    it('cuts the text to 16 characters', () => {
        expect(scoreboardDesign({ version: 1, scoreboard: { text: 'x'.repeat(20), accent: '#ffffff' } })).toEqual({
            text: 'x'.repeat(16),
            accent: '#ffffff',
        });
    });
});

describe('scoreboardTexture', () => {
    afterEach(() => vi.restoreAllMocks());

    it('draws the accent bars and the text', () => {
        const calls = spyContext();
        scoreboardTexture(BOARD);
        expect(calls.fillRect.filter(([style]) => style === BOARD.accent)).toHaveLength(2);
        expect(calls.fillText.map(([text]) => text)).toEqual(['HARBOR']);
    });

    it('is blank without a 2D context', () => {
        expect(scoreboardTexture(BOARD).image).toBeInstanceOf(HTMLCanvasElement);
    });
});

describe('buildScoreboard', () => {
    it('is two meshes and 20 triangles, named scoreboard', () => {
        const board = buildScoreboard(BOARD);
        expect(board.name).toBe('scoreboard');
        const meshes = board.children.filter((child): child is Mesh => child instanceof Mesh);
        expect(meshes).toHaveLength(2);
        expect(meshes.reduce((total, mesh) => total + triangles(mesh), 0)).toBe(20);
    });

    it('hangs with its bottom at 8 m', () => {
        const board = buildScoreboard(BOARD);
        board.updateMatrixWorld();
        const housing = board.children.find((child) => child.name !== 'scoreboard-screens') as Mesh;
        housing.geometry.computeBoundingBox();
        const box = housing.geometry.boundingBox!.clone().applyMatrix4(housing.matrixWorld);
        expect(box.min.y).toBeCloseTo(SCOREBOARD_SIZE.bottom);
        expect(box.max.y).toBeCloseTo(SCOREBOARD_SIZE.bottom + SCOREBOARD_SIZE.height);
    });

    it("faces every screen away from the board's centre", () => {
        const screens = buildScoreboard(BOARD).getObjectByName('scoreboard-screens') as Mesh;
        const position = screens.geometry.getAttribute('position');
        const centreY = SCOREBOARD_SIZE.bottom + SCOREBOARD_SIZE.height / 2;
        for (let i = 0; i < position.count; i += 3) {
            const [a, b, c] = [0, 1, 2].map((j) => new Vector3().fromBufferAttribute(position, i + j));
            const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
            const middle = a.clone().add(b).add(c).divideScalar(3);
            const outward = middle.sub(new Vector3(0, centreY, 0)).setY(0);
            expect(normal.dot(outward)).toBeGreaterThan(0);
        }
    });
});
