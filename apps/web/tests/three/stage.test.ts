import { describe, expect, it, vi } from 'vitest';
import { Color, Fog, Group, Mesh, Object3D } from 'three';

const shared = vi.hoisted(() => ({ disposeObject: vi.fn() }));
vi.mock('@/three/renderer/shared', () => ({ disposeObject: shared.disposeObject }));

import { buildArena, createStage, placeInRows } from '@/three/scene/stage';
import { SCENE_COLOURS } from '@/three/arena/palette';

const roots = (count: number) => Array.from({ length: count }, () => new Group());
const shadowsIn = (group: Group) => group.children.filter((child) => child.name === 'shadow');

describe('createStage', () => {
    it('gives an opaque background, fog and lights', () => {
        const scene = createStage();
        expect(scene.background).toEqual(new Color(SCENE_COLOURS.background));
        expect(scene.fog).toBeInstanceOf(Fog);
        expect(scene.children.length).toBeGreaterThan(0);
    });
});

describe('buildArena', () => {
    it('builds the default court and a bowl without a court canvas', () => {
        const arena = buildArena(null, 18000, { capabilities: { getMaxAnisotropy: () => 1 } } as never);
        expect(arena).toBeInstanceOf(Group);
        expect(arena.children).toHaveLength(2);
    });
});

describe('placeInRows', () => {
    it('stands everyone in one row 1.35 m apart, each with a shadow', () => {
        const group = new Group();
        const people = roots(7);
        placeInRows(group, people, false);
        expect(shadowsIn(group)).toHaveLength(7);
        const xs = people.map((root) => root.position.x);
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(1.35);
    });

    it('uses two rows when asked', () => {
        const group = new Group();
        const people = roots(7);
        placeInRows(group, people, true);
        expect(new Set(people.map((root) => root.position.z)).size).toBe(2);
    });

    it('disposes only the old shadows when placing again', () => {
        const group = new Group();
        const people = roots(3);
        placeInRows(group, people, false);
        const oldShadows = shadowsIn(group);
        shared.disposeObject.mockClear();
        placeInRows(group, people, true);
        expect(shared.disposeObject).toHaveBeenCalledTimes(3);
        for (const shadow of oldShadows) expect(shared.disposeObject).toHaveBeenCalledWith(shadow);
        expect(group.children.filter((child: Object3D) => child instanceof Mesh)).toHaveLength(3);
        expect(group.children).toHaveLength(6);
    });
});
