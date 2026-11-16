import { Color, Fog, Group, Scene, type Mesh, type Object3D, type WebGLRenderer } from 'three';
import type { VenueDesign } from '@/constants/venue';
import { buildBowl, bowlLayout } from '@/three/arena/bowl';
import { buildCourt, courtTexture } from '@/three/arena/court';
import { broadcastLighting } from '@/three/arena/lighting';
import { FOG, SCENE_COLOURS } from '@/three/arena/palette';
import { seatColouring } from '@/three/arena/seats';
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

export const buildCourtFloor = (court: HTMLCanvasElement | null, renderer: WebGLRenderer): Group =>
    buildCourt(court ? courtTexture(court, renderer) : null);

// An arena without a venue gets today's bowl: the capacity's decks, solid seats.
export const buildSeating = (capacity: number | null, venue: VenueDesign | null): Mesh =>
    buildBowl(bowlLayout(capacity, venue?.upperDeck), seatColouring(venue));

export const buildArena = (
    court: HTMLCanvasElement | null,
    capacity: number | null,
    renderer: WebGLRenderer,
    venue: VenueDesign | null = null,
): Group => {
    const arena = new Group();
    arena.add(buildCourtFloor(court, renderer));
    arena.add(buildSeating(capacity, venue));
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
