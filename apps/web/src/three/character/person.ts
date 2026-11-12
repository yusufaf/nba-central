// One person in the team scene: the CC0 body, cloned, painted with the
// team's uniform (or a suit for staff) as a neutral figurine, sized from
// their height and weight, arms relaxed, facing the camera.
import { Group, Vector3, type MeshStandardMaterial, type Object3D, type SkinnedMesh } from 'three';
import bodyUrl from '../assets/athletic-male.glb?url';
import type { PersonAppearance } from '@/constants/appearance';
import { attachHair, FACIAL_HAIR_ASSETS, HAIR_ASSETS } from './appearance';
import { bodySize, girthFor, type Role } from './body';
import type { KitColours } from '@/utils/jerseyColours';
import { addRegions, applyKitMaterial, findLandmarks, kitTexture } from './kit';
import { cloneCharacter, loadBody } from './load';
import { POSE_BUILDERS } from './poses';
import { reshapeBody } from './reshape';

export interface PersonInput {
    id: string;
    name: string;
    role: Role;
    position?: string;
    heightInches: number | null;
    weightPounds: number | null;
    number?: string | null;
    /** A custom person's look; without one they're a figurine. */
    appearance?: PersonAppearance | null;
}

// Real people are figurines (spec decision 3).
const VINYL = '#c8c3ba';
const INCH = 0.0254;
const WINGSPAN = 1.03;

const skinnedIn = (root: Object3D): SkinnedMesh[] => {
    const meshes: SkinnedMesh[] = [];
    root.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
    });
    return meshes;
};

export const buildPerson = async (
    input: PersonInput,
    kit: { colours: KitColours; teamName: string },
): Promise<{ root: Group; headHeight: number }> => {
    const character = cloneCharacter(await loadBody(bodyUrl));
    const meshes = skinnedIn(character);
    const body = meshes.reduce((a, b) =>
        a.geometry.getAttribute('position').count >= b.geometry.getAttribute('position').count ? a : b,
    );
    const look = input.appearance ?? null;
    if (look) {
        // Eyes and brows stay; the brows take the hair colour.
        for (const mesh of meshes) {
            const material = mesh.material as MeshStandardMaterial;
            if (mesh !== body && /hair/i.test(material.name)) material.color.set(look.hair.color);
        }
        const attached = await Promise.allSettled([
            look.hair.style !== 'none' && attachHair(character, body, HAIR_ASSETS[look.hair.style], look.hair.color, 'hair'),
            look.facialHair.style !== 'none' &&
                attachHair(character, body, FACIAL_HAIR_ASSETS[look.facialHair.style], look.facialHair.color, 'facialHair'),
        ]);
        for (const result of attached) {
            if (result.status === 'rejected') console.warn('Could not load hair for', input.name, result.reason);
        }
        // The pack's one body texture is a dark tone, so skin is a flat
        // colour; the normal and roughness maps keep the form.
        const skin = body.material as MeshStandardMaterial;
        skin.map = null;
        skin.color.set(look.skin);
        skin.needsUpdate = true;
    } else {
        // Figurines have no eyes or brows.
        for (const mesh of meshes) if (mesh !== body) mesh.visible = false;
    }

    // Reshape first: the kit shader reads the reshaped rest positions, so its
    // landmarks have to come from the same body.
    const size = bodySize(input);
    reshapeBody(character, { girth: girthFor(size), shoulders: 1, wingspan: WINGSPAN });
    character.updateMatrixWorld(true);

    addRegions(body);
    const landmarks = findLandmarks(body);
    const kind = input.role === 'player' ? 'player' : 'suit';
    const texture = kitTexture({
        kind,
        teamName: kit.teamName,
        number: input.number ?? null,
        trim: kit.colours.trim,
        secondary: kit.colours.secondary,
    });
    body.material = applyKitMaterial(body.material as MeshStandardMaterial, {
        kind,
        colours: kit.colours,
        landmarks,
        vinyl: look ? null : VINYL,
        texture,
    });

    // Face down +z, toward the team-photo camera.
    const root = new Group();
    root.add(character);
    character.updateMatrixWorld(true);
    const facing = new Vector3(0, 0, landmarks.front).transformDirection(body.bindMatrix);
    character.rotation.y = -Math.atan2(facing.x, facing.z);
    character.updateMatrixWorld(true);
    POSE_BUILDERS[look?.pose ?? 'relaxed'](character, new Vector3(0, 0, 1));

    // Metres, from the body's rest height.
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox!;
    const heightMetres = size.heightInches * INCH;
    root.scale.setScalar(heightMetres / (box.max.y - box.min.y));
    root.name = input.id;
    return { root, headHeight: heightMetres };
};
