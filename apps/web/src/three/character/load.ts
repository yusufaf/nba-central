import { BufferAttribute, Matrix3, Matrix4, MeshStandardMaterial, SkinnedMesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const skinnedIn = (root: Object3D): SkinnedMesh[] => {
    const meshes: SkinnedMesh[] = [];
    root.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
    });
    return meshes;
};

// gltf-transform's meshopt step quantizes positions and, because a skinned
// mesh's node transform is ignored, hides the dequantizing scale in the
// inverse bind matrices. Anything that recomputes those (reshaping a body)
// would drop it, so it is baked back into float positions and normals once,
// and the inverse bind matrices become plain inverses of the rest pose.
export const dequantizeSkinned = (root: Object3D): void => {
    root.updateMatrixWorld(true);
    for (const mesh of skinnedIn(root)) {
        const { skeleton, geometry } = mesh;
        const atRest = new Matrix4().multiplyMatrices(skeleton.bones[0].matrixWorld, skeleton.boneInverses[0]);
        const transform = new Matrix4().copy(mesh.bindMatrix).invert().multiply(atRest).multiply(mesh.bindMatrix);
        const normalTransform = new Matrix3().getNormalMatrix(transform);
        const point = new Vector3();

        const source = geometry.getAttribute('position');
        const positions = new Float32Array(source.count * 3);
        for (let v = 0; v < source.count; v++) {
            point.fromBufferAttribute(source, v).applyMatrix4(transform).toArray(positions, v * 3);
        }
        geometry.setAttribute('position', new BufferAttribute(positions, 3));

        const sourceNormal = geometry.getAttribute('normal');
        if (sourceNormal) {
            const normals = new Float32Array(sourceNormal.count * 3);
            for (let v = 0; v < sourceNormal.count; v++) {
                point.fromBufferAttribute(sourceNormal, v).applyMatrix3(normalTransform).normalize().toArray(normals, v * 3);
            }
            geometry.setAttribute('normal', new BufferAttribute(normals, 3));
        }
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        skeleton.calculateInverses();
    }
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const bodies = new Map<string, Promise<Object3D>>();

// Each body file loads and dequantizes once per page; characters are clones.
export const loadBody = (url: string): Promise<Object3D> => {
    let pending = bodies.get(url);
    if (!pending) {
        pending = loader.loadAsync(url).then((gltf) => {
            dequantizeSkinned(gltf.scene);
            return gltf.scene;
        });
        bodies.set(url, pending);
    }
    return pending;
};

// A character that can be reshaped and recoloured without touching the
// source or any other clone. SkeletonUtils.clone shares geometry and
// materials, and Skeleton.clone shares the boneInverses array, which
// calculateInverses() then empties in place.
export const cloneCharacter = (source: Object3D): Object3D => {
    const character = cloneSkinned(source);
    for (const mesh of skinnedIn(character)) {
        mesh.geometry = mesh.geometry.clone();
        mesh.material = (mesh.material as MeshStandardMaterial).clone();
        mesh.frustumCulled = false;
        mesh.skeleton.boneInverses = mesh.skeleton.boneInverses.map((inverse) => inverse.clone());
    }
    return character;
};
