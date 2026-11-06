// Throwaway spike (#119). Builds one character from a CC0 Quaternius base:
// clone, attach hair, add the kit (painted or shell), reshape, pose, scale.
import {
    Bone,
    BufferAttribute,
    Group,
    Matrix3,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Object3D,
    Quaternion,
    Skeleton,
    SkinnedMesh,
    Vector3,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import maleUrl from '../assets/Superhero_Male_FullBody.glb?url';
import femaleUrl from '../assets/Superhero_Female_FullBody.glb?url';
import buzzedUrl from '../assets/hair/Hair_Buzzed.glb?url';
import buzzedFemaleUrl from '../assets/hair/Hair_BuzzedFemale.glb?url';
import partedUrl from '../assets/hair/Hair_SimpleParted.glb?url';
import longUrl from '../assets/hair/Hair_Long.glb?url';
import bunsUrl from '../assets/hair/Hair_Buns.glb?url';
import beardUrl from '../assets/hair/Hair_Beard.glb?url';
import { reshapeBody, type BodyShape } from './reshape';
import { addRegions, applyKitMaterial, buildShell, findLandmarks, kitTexture, type Kit, type KitMode } from './kit';

export type Frame = 'male' | 'female';
export type HairStyle = 'none' | 'buzzed' | 'buzzedFemale' | 'parted' | 'long' | 'buns';

const FRAME_URLS: Record<Frame, string> = { male: maleUrl, female: femaleUrl };
const HAIR_URLS: Record<Exclude<HairStyle, 'none'>, string> = {
    buzzed: buzzedUrl,
    buzzedFemale: buzzedFemaleUrl,
    parted: partedUrl,
    long: longUrl,
    buns: bunsUrl,
};

export interface CharacterSpec {
    frame: Frame;
    heightInches: number;
    weightPounds: number;
    shoulders: number;
    wingspan: number;
    girthOverride?: number;
    hair: HairStyle;
    beard: boolean;
    hairColour: string;
    skinTint: string | null; // null keeps the texture's own tone
    vinyl: string | null; // figurine: real people
    kit: Kit;
    kitMode: KitMode;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

// gltf-transform's meshopt step quantizes positions to int16 and, because a
// skinned mesh's node transform is ignored, hides the dequantizing scale in
// the inverse bind matrices. Anything that recomputes those (reshaping,
// rebinding hair) would drop it. So bake it back into float positions and
// normals once, and make the inverse bind matrices plain again.
const dequantize = (scene: Object3D) => {
    scene.updateMatrixWorld(true);
    for (const mesh of skinnedIn(scene)) {
        const skeleton = mesh.skeleton;
        const restSkin = new Matrix4().multiplyMatrices(skeleton.bones[0].matrixWorld, skeleton.boneInverses[0]);
        const full = new Matrix4().copy(mesh.bindMatrix).invert().multiply(restSkin).multiply(mesh.bindMatrix);
        const normalMatrix = new Matrix3().getNormalMatrix(full);
        const geometry = mesh.geometry;
        const source = geometry.getAttribute('position');
        const positions = new Float32Array(source.count * 3);
        const p = new Vector3();
        for (let v = 0; v < source.count; v++) {
            p.fromBufferAttribute(source, v).applyMatrix4(full);
            positions.set([p.x, p.y, p.z], v * 3);
        }
        geometry.setAttribute('position', new BufferAttribute(positions, 3));
        const sourceNormal = geometry.getAttribute('normal');
        if (sourceNormal) {
            const normals = new Float32Array(sourceNormal.count * 3);
            for (let v = 0; v < sourceNormal.count; v++) {
                p.fromBufferAttribute(sourceNormal, v).applyMatrix3(normalMatrix).normalize();
                normals.set([p.x, p.y, p.z], v * 3);
            }
            geometry.setAttribute('normal', new BufferAttribute(normals, 3));
        }
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        skeleton.calculateInverses();
    }
    return scene;
};

const load = (url: string) => {
    let pending = cache.get(url);
    if (!pending) {
        pending = loader.loadAsync(url).then((gltf) => {
            dequantize(gltf.scene);
            return gltf;
        });
        cache.set(url, pending);
    }
    return pending;
};

export const preload = (frames: Frame[] = ['male', 'female']) =>
    Promise.all([...frames.map((f) => load(FRAME_URLS[f])), ...Object.values(HAIR_URLS).map(load), load(beardUrl)]);

const skinnedIn = (root: Object3D): SkinnedMesh[] => {
    const meshes: SkinnedMesh[] = [];
    root.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
    });
    return meshes;
};

// Hair ships with its own copy of the skeleton. Rebind it to the character's
// bones by name, in the character's rest pose, before anything is reshaped.
const attachHair = async (character: Object3D, url: string, colour: string) => {
    const gltf = await load(url);
    const source = skinnedIn(gltf.scene)[0];
    if (!source) return;
    const bones = new Map<string, Bone>();
    character.traverse((node) => {
        if ((node as Bone).isBone) bones.set(node.name, node as Bone);
    });
    const mapped = source.skeleton.bones.map((bone) => bones.get(bone.name));
    if (mapped.some((bone) => !bone)) return;
    const hair = new SkinnedMesh(source.geometry.clone(), (source.material as MeshStandardMaterial).clone());
    (hair.material as MeshStandardMaterial).color.set(colour);
    const host = skinnedIn(character)[0];
    (host.parent ?? character).add(hair);
    hair.position.copy(host.position);
    hair.quaternion.copy(host.quaternion);
    hair.scale.copy(host.scale);
    character.updateMatrixWorld(true);
    hair.bind(new Skeleton(mapped as Bone[]));
    hair.name = 'hair';
};

const girthFor = (heightInches: number, weightPounds: number) => {
    const bmi = (703 * weightPounds) / (heightInches * heightInches);
    return Math.min(1.3, Math.max(0.86, 1 + (bmi - 25) * 0.035));
};

const boneByName = (root: Object3D, name: string) => root.getObjectByName(name) as Bone | undefined;

// Turns a bone in world space, so the result doesn't depend on bone roll.
const turnTowards = (bone: Bone, child: Bone, target: Vector3) => {
    bone.updateMatrixWorld(true);
    const from = child.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3())).normalize();
    const turn = new Quaternion().setFromUnitVectors(from, target.clone().normalize());
    const world = bone.getWorldQuaternion(new Quaternion());
    const parentWorld = bone.parent ? bone.parent.getWorldQuaternion(new Quaternion()) : new Quaternion();
    bone.quaternion.copy(parentWorld.invert().multiply(turn).multiply(world));
    bone.updateMatrixWorld(true);
};

// Arms down by the sides, a slight bend at the elbow.
export const relaxedPose = (root: Object3D, forward: Vector3) => {
    root.updateMatrixWorld(true);
    for (const side of ['l', 'r'] as const) {
        const upper = boneByName(root, `upperarm_${side}`);
        const lower = boneByName(root, `lowerarm_${side}`);
        const hand = boneByName(root, `hand_${side}`);
        if (!upper || !lower || !hand) continue;
        const outward = upper.getWorldPosition(new Vector3()).sub(boneByName(root, 'spine_03')!.getWorldPosition(new Vector3()));
        outward.y = 0;
        outward.normalize();
        turnTowards(upper, lower, new Vector3(0, -1, 0).addScaledVector(outward, 0.16));
        turnTowards(lower, hand, new Vector3(0, -1, 0).addScaledVector(outward, 0.1).addScaledVector(forward, 0.22));
    }
};

const DEBUG = new URLSearchParams(location.search);

export interface BuiltCharacter {
    root: Group;
    triangles: number;
}

export const buildCharacter = async (spec: CharacterSpec): Promise<BuiltCharacter> => {
    const gltf = await load(FRAME_URLS[spec.frame]);
    const character = cloneSkinned(gltf.scene);
    const meshes = skinnedIn(character);
    for (const mesh of meshes) {
        mesh.geometry = mesh.geometry.clone();
        mesh.material = (mesh.material as MeshStandardMaterial).clone();
        mesh.frustumCulled = false;
        // Skeleton.clone() shares the boneInverses array, and
        // calculateInverses() empties it in place: every clone and the cached
        // source would be reshaped together.
        mesh.skeleton.boneInverses = mesh.skeleton.boneInverses.map((inverse) => inverse.clone());
    }
    if (spec.hair !== 'none' && !spec.vinyl) await attachHair(character, HAIR_URLS[spec.hair], spec.hairColour);
    if (spec.beard && !spec.vinyl) await attachHair(character, beardUrl, spec.hairColour);

    // The body is the mesh with the most vertices; the others are eyes/brows.
    const body = meshes.reduce((a, b) =>
        a.geometry.getAttribute('position').count >= b.geometry.getAttribute('position').count ? a : b,
    );
    addRegions(body);
    const landmarks = findLandmarks(body);
    const texture = kitTexture(spec.kit);
    const baseMaterial = body.material as MeshStandardMaterial;
    if (spec.skinTint && !spec.vinyl) baseMaterial.color.set(spec.skinTint);

    if (spec.kitMode !== 'none') {
        body.material = applyKitMaterial(baseMaterial, { kit: spec.kit, landmarks, vinyl: spec.vinyl, texture });
    } else if (spec.vinyl) {
        body.material = applyKitMaterial(baseMaterial, {
            kit: { ...spec.kit, primary: spec.vinyl, secondary: spec.vinyl },
            landmarks,
            vinyl: spec.vinyl,
            texture,
        });
    }
    if (spec.kitMode === 'shell') {
        const shell = buildShell(body, landmarks, spec.kit.kind);
        if (shell) {
            shell.material = applyKitMaterial(baseMaterial, {
                kit: spec.kit,
                landmarks,
                vinyl: spec.vinyl,
                texture,
                forceKit: true,
            });
            shell.frustumCulled = false;
            (body.parent ?? character).add(shell);
            shell.position.copy(body.position);
            shell.quaternion.copy(body.quaternion);
            shell.scale.copy(body.scale);
            shell.bind(body.skeleton, body.bindMatrix);
        }
    }
    if (spec.vinyl) {
        for (const mesh of meshes) if (mesh !== body) mesh.visible = false;
    }

    const shape: BodyShape = {
        girth: spec.girthOverride ?? girthFor(spec.heightInches, spec.weightPounds),
        shoulders: spec.shoulders,
        wingspan: spec.wingspan,
    };
    if (!DEBUG.has('noreshape')) reshapeBody(character, shape);

    // Face the character down +z.
    const forwardGeom = new Vector3(0, 0, landmarks.front);
    const root = new Group();
    root.add(character);
    character.updateMatrixWorld(true);
    const toWorld = new Vector3().copy(forwardGeom).transformDirection(body.bindMatrix);
    toWorld.y = 0;
    toWorld.normalize();
    character.rotation.y = Math.atan2(toWorld.x, toWorld.z) * -1;
    character.updateMatrixWorld(true);
    if (!DEBUG.has('nopose')) relaxedPose(character, new Vector3(0, 0, 1));

    // Height in metres; the body's rest height sets the scale.
    root.updateMatrixWorld(true);
    const box = new Vector3();
    body.geometry.computeBoundingBox();
    body.geometry.boundingBox!.getSize(box);
    const restHeight = box.y * new Vector3().setFromMatrixScale(body.bindMatrix).y;
    const targetHeight = spec.heightInches * 0.0254;
    root.scale.setScalar(targetHeight / restHeight);
    root.userData.height = targetHeight;

    let triangles = 0;
    root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const index = mesh.geometry.getIndex();
        triangles += (index ? index.count : mesh.geometry.getAttribute('position').count) / 3;
    });
    return { root, triangles };
};
