import { Color, Fog, Group, Scene, type Object3D, type WebGLRenderer } from 'three';
import { buildBowl, bowlLayout } from '@/three/arena/bowl';
import { buildCourt, courtTexture } from '@/three/arena/court';
import { broadcastLighting } from '@/three/arena/lighting';
import { FOG, SCENE_COLOURS } from '@/three/arena/palette';
import { blobShadow } from '@/three/arena/shadow';
import { disposeObject } from '@/three/renderer/shared';
import { layoutPeople } from './layout';

// The parts of the team's arena that the live scene and the share card's
// team photo both use.

export const createStage = (): Scene => {
    const scene = new Scene();
    scene.background = new Color(SCENE_COLOURS.background);
    scene.fog = new Fog(SCENE_COLOURS.background, FOG.near, FOG.far);
    scene.add(broadcastLighting());
    return scene;
};

export const buildArena = (court: HTMLCanvasElement | null, capacity: number | null, renderer: WebGLRenderer): Group => {
    const arena = new Group();
    arena.add(buildCourt(court ? courtTexture(court, renderer) : null));
    arena.add(buildBowl(bowlLayout(capacity), SCENE_COLOURS.seat));
    return arena;
};

// People are reused across layouts; their shadows are rebuilt.
export const placeInRows = (group: Group, roots: Object3D[], twoRows: boolean): void => {
    for (const child of group.children) if (child.name === 'shadow') disposeObject(child);
    group.clear();
    const spots = layoutPeople(roots.length, twoRows);
    roots.forEach((root, i) => {
        const { x, z } = spots[i];
        root.position.set(x, 0, z);
        const shadow = blobShadow(0.45);
        shadow.position.set(x, 0.005, z);
        group.add(root, shadow);
    });
};
