import { Group, PerspectiveCamera } from 'three';
import { buildPerson, type PersonInput } from '@/three/character/person';
import type { KitColours } from '@/three/character/jerseyColours';
import { renderToImageData } from '@/three/renderer/offscreen';
import { disposeObject, getSharedRenderer } from '@/three/renderer/shared';
import { TWO_ROWS_BELOW_ASPECT, framePreset } from './cameraPresets';
import { buildArena, createStage, placeInRows } from './stage';

// The share card's size (useShareCard renders the card at this size too).
export const CARD_SIZE = { width: 1200, height: 630 };

// The team-photo shot of the 3D scene, at card size, as a canvas. Built and
// thrown away on each call: nothing is shared with a live TeamScene but the
// renderer, which renders into its own target here.
export const renderTeamPhotoFrame = async (input: {
    court: HTMLCanvasElement | null;
    capacity: number | null;
    people: PersonInput[];
    kit: { colours: KitColours; teamName: string };
}): Promise<HTMLCanvasElement> => {
    const settled = await Promise.allSettled(input.people.map((person) => buildPerson(person, input.kit)));
    const failed = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    const roots = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value.root] : []));
    if (failed) {
        for (const root of roots) disposeObject(root);
        throw failed.reason;
    }

    const { width, height } = CARD_SIZE;
    const aspect = width / height;
    // Everyone joins the scene before anything that can fail, so disposing the
    // scene always frees them.
    const scene = createStage();
    const group = new Group();
    group.add(...roots);
    scene.add(group);
    try {
        placeInRows(group, roots, aspect < TWO_ROWS_BELOW_ASPECT);
        const renderer = getSharedRenderer();
        scene.add(buildArena(input.court, input.capacity, renderer));

        const { position, target, fov } = framePreset('team', aspect);
        const camera = new PerspectiveCamera(fov, aspect, 0.1, 200);
        camera.position.set(...position);
        camera.lookAt(...target);
        camera.updateProjectionMatrix();

        const image = renderToImageData(renderer, scene, camera, width, height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2D canvas context');
        context.putImageData(image, 0, 0);
        return canvas;
    } finally {
        disposeObject(scene);
    }
};
