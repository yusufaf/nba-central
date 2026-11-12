// What a custom person's look loads: one GLB per hair and facial hair style,
// skinned to the same rig as the body.
import { Skeleton, SkinnedMesh, type Bone, type MeshStandardMaterial, type Object3D } from 'three';
import type { FacialHairId, HairStyleId } from '@/constants/appearance';
import buzzedUrl from '../assets/hair/buzzed.glb?url';
import partedUrl from '../assets/hair/parted.glb?url';
import beardUrl from '../assets/hair/beard.glb?url';
import { loadBody } from './load';

export const HAIR_ASSETS: Record<Exclude<HairStyleId, 'none'>, string> = {
    buzzed: buzzedUrl,
    parted: partedUrl,
};

export const FACIAL_HAIR_ASSETS: Record<Exclude<FacialHairId, 'none'>, string> = {
    beard: beardUrl,
};

const firstSkinned = (root: Object3D): SkinnedMesh | undefined => {
    let found: SkinnedMesh | undefined;
    root.traverse((node) => {
        if (!found && (node as SkinnedMesh).isSkinnedMesh) found = node as SkinnedMesh;
    });
    return found;
};

/**
 * Puts a hair GLB on `body`, bound to the character's own bones by name, so
 * reshaping and posing move it with the head. Adds nothing when the file's
 * rig doesn't match.
 */
export const attachHair = async (character: Object3D, body: SkinnedMesh, url: string, colour: string, name: string) => {
    const source = firstSkinned(await loadBody(url));
    if (!source) return;
    const bones = new Map<string, Bone>();
    character.traverse((node) => {
        if ((node as Bone).isBone) bones.set(node.name, node as Bone);
    });
    const mapped = source.skeleton.bones.map((bone) => bones.get(bone.name));
    if (mapped.some((bone) => !bone)) {
        console.warn(`Skipped ${name}: its rig doesn't match the body's`, url);
        return;
    }

    const material = (source.material as MeshStandardMaterial).clone();
    material.color.set(colour);
    const hair = new SkinnedMesh(source.geometry.clone(), material);
    (body.parent ?? character).add(hair);
    hair.position.copy(body.position);
    hair.quaternion.copy(body.quaternion);
    hair.scale.copy(body.scale);
    character.updateMatrixWorld(true);
    hair.bind(new Skeleton(mapped as Bone[]));
    hair.frustumCulled = false;
    hair.name = name;
};
