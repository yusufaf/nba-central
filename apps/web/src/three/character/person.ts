// One person in the team scene: the CC0 body, cloned, painted with the
// team's uniform (or a staff member's outfit) as a neutral figurine, sized
// from their height and weight, arms relaxed, facing the camera. A custom
// person's gear is fitted to the reshaped body and rides its bone; a custom
// coach's or GM's age look greys their hair and adds a little girth.
import { Box3, Group, Vector3, type MeshStandardMaterial, type Object3D, type SkinnedMesh } from 'three';
import type { PersonAppearance, StaffAppearance } from '@/constants/appearance';
import { DEFAULT_OUTFIT } from '@/utils/appearance';
import { agedBuild, agedColour, facialHairFits, fits, isStaffLook } from '@/utils/appearanceOptions';
import { attachAccessories } from './accessories';
import { attachHair, BODY_ASSETS, FACIAL_HAIR_ASSETS, HAIR_ASSETS } from './appearance';
import { bodySize, shapeFor, type Role } from './body';
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
    /** A custom person's look; without one they're a figurine. A coach's or GM's is a staff look. */
    appearance?: PersonAppearance | StaffAppearance | null;
}

// Real people are figurines (spec decision 3).
const VINYL = '#c8c3ba';
const INCH = 0.0254;

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
    const look = input.appearance ?? null;
    const staffLook = input.role !== 'player' && isStaffLook(look) ? look : null;
    // Real staff, and any without a staff look, wear the default suit.
    const outfit = input.role === 'player' ? null : (staffLook?.outfit ?? DEFAULT_OUTFIT);
    const aged = (colour: string) => (staffLook ? agedColour(colour, staffLook.ageLook) : colour);
    // Figurines are always the male frame.
    const character = cloneCharacter(await loadBody(BODY_ASSETS[look?.frame ?? 'm']));
    const meshes = skinnedIn(character);
    const body = meshes.reduce((a, b) =>
        a.geometry.getAttribute('position').count >= b.geometry.getAttribute('position').count ? a : b,
    );
    if (look) {
        // Eyes and brows stay; the brows take the hair colour.
        for (const mesh of meshes) {
            const material = mesh.material as MeshStandardMaterial;
            if (mesh !== body && /hair/i.test(material.name)) material.color.set(aged(look.hair.color));
        }
        // A cut shaped for the other head is skipped: the creator never
        // offers one, so only a hand-made look can carry it.
        const { hair, facialHair } = look;
        const attached = await Promise.allSettled([
            hair.style !== 'none' &&
                fits(look.frame, hair.style) &&
                attachHair(character, body, HAIR_ASSETS[hair.style], aged(hair.color), 'hair'),
            facialHair.style !== 'none' &&
                facialHairFits(look.frame, facialHair.style) &&
                attachHair(character, body, FACIAL_HAIR_ASSETS[facialHair.style], aged(facialHair.color), 'facialHair'),
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
    reshapeBody(character, shapeFor(size, staffLook ? agedBuild(staffLook) : look?.build));
    character.updateMatrixWorld(true);

    addRegions(body);
    const landmarks = findLandmarks(body);
    const facing = new Vector3(0, 0, landmarks.front).transformDirection(body.bindMatrix);
    if (look && look.accessories.length) attachAccessories(character, body, look.accessories, facing);
    const kind = outfit ? outfit.style : 'player';
    const colours = outfit ? { primary: outfit.primary, secondary: outfit.secondary, trim: outfit.secondary } : kit.colours;
    const texture = kitTexture({
        kind,
        teamName: kit.teamName,
        number: input.number ?? null,
        trim: kit.colours.trim,
        secondary: kit.colours.secondary,
    });
    body.material = applyKitMaterial(body.material as MeshStandardMaterial, {
        kind,
        colours,
        landmarks,
        vinyl: look ? null : VINYL,
        texture,
    });

    // Face down +z, toward the team-photo camera.
    const root = new Group();
    root.add(character);
    character.updateMatrixWorld(true);
    character.rotation.y = -Math.atan2(facing.x, facing.z);
    character.updateMatrixWorld(true);
    POSE_BUILDERS[look?.pose ?? 'relaxed'](character, new Vector3(0, 0, 1));

    // Metres, from the body's rest height.
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox!;
    const heightMetres = size.heightInches * INCH;
    root.scale.setScalar(heightMetres / (box.max.y - box.min.y));
    // The asset's posed soles sit a little below its origin.
    root.updateMatrixWorld(true);
    character.position.y -= new Box3().setFromObject(body, true).min.y / root.scale.y;
    root.name = input.id;
    return { root, headHeight: heightMetres };
};
