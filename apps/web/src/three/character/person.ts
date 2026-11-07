// One person in the team scene: the CC0 body, cloned, painted with the
// team's uniform (or a suit for staff) as a neutral figurine, sized from
// their height and weight, arms relaxed, facing the camera.
import { Bone, Group, Quaternion, Vector3, type MeshStandardMaterial, type Object3D, type SkinnedMesh } from 'three';
import bodyUrl from '../assets/athletic-male.glb?url';
import { bodySize, girthFor, type Role } from './body';
import type { KitColours } from './jerseyColours';
import { addRegions, applyKitMaterial, findLandmarks, kitTexture } from './kit';
import { cloneCharacter, loadBody } from './load';
import { reshapeBody } from './reshape';

export interface PersonInput {
    id: string;
    name: string;
    role: Role;
    position?: string;
    heightInches: number | null;
    weightPounds: number | null;
}

// Real people are figurines (spec decision 3); in this slice everyone is.
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

const bone = (root: Object3D, name: string) => root.getObjectByName(name) as Bone | undefined;

// Turns a bone in world space so its child points along `target`, which
// works whatever the bone's roll.
const point = (parent: Bone, child: Bone, target: Vector3) => {
    parent.updateMatrixWorld(true);
    const from = child.getWorldPosition(new Vector3()).sub(parent.getWorldPosition(new Vector3())).normalize();
    const turn = new Quaternion().setFromUnitVectors(from, target.clone().normalize());
    const world = parent.getWorldQuaternion(new Quaternion());
    const above = parent.parent ? parent.parent.getWorldQuaternion(new Quaternion()) : new Quaternion();
    parent.quaternion.copy(above.invert().multiply(turn).multiply(world));
    parent.updateMatrixWorld(true);
};

// The model is in a T-pose: arms down by the sides, a slight bend at the elbow.
const relaxArms = (root: Object3D, forward: Vector3) => {
    root.updateMatrixWorld(true);
    const chest = bone(root, 'spine_03');
    for (const side of ['l', 'r']) {
        const upper = bone(root, `upperarm_${side}`);
        const lower = bone(root, `lowerarm_${side}`);
        const hand = bone(root, `hand_${side}`);
        if (!chest || !upper || !lower || !hand) continue;
        const outward = upper.getWorldPosition(new Vector3()).sub(chest.getWorldPosition(new Vector3()));
        outward.y = 0;
        outward.normalize();
        point(upper, lower, new Vector3(0, -1, 0).addScaledVector(outward, 0.16));
        point(lower, hand, new Vector3(0, -1, 0).addScaledVector(outward, 0.1).addScaledVector(forward, 0.22));
    }
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
    // Figurines have no eyes or brows.
    for (const mesh of meshes) if (mesh !== body) mesh.visible = false;

    addRegions(body);
    const landmarks = findLandmarks(body);
    const kind = input.role === 'player' ? 'player' : 'suit';
    const texture = kitTexture({ kind, teamName: kit.teamName, trim: kit.colours.trim, secondary: kit.colours.secondary });
    body.material = applyKitMaterial(body.material as MeshStandardMaterial, {
        kind,
        colours: kit.colours,
        landmarks,
        vinyl: VINYL,
        texture,
    });

    const size = bodySize(input);
    reshapeBody(character, { girth: girthFor(size), shoulders: 1, wingspan: WINGSPAN });

    // Face down +z, toward the team-photo camera.
    const root = new Group();
    root.add(character);
    character.updateMatrixWorld(true);
    const facing = new Vector3(0, 0, landmarks.front).transformDirection(body.bindMatrix);
    character.rotation.y = -Math.atan2(facing.x, facing.z);
    character.updateMatrixWorld(true);
    relaxArms(character, new Vector3(0, 0, 1));

    // Metres, from the body's rest height.
    body.geometry.computeBoundingBox();
    const box = body.geometry.boundingBox!;
    const heightMetres = size.heightInches * INCH;
    root.scale.setScalar(heightMetres / (box.max.y - box.min.y));
    root.name = input.id;
    return { root, headHeight: heightMetres };
};
