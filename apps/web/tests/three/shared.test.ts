import { describe, expect, it, vi } from 'vitest';
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Skeleton, SkinnedMesh, Texture } from 'three';
import { disposeObject } from '@/three/renderer/shared';

describe('disposeObject', () => {
    it('disposes every geometry, material and texture under the root once', () => {
        const geometry = new BoxGeometry();
        const texture = new Texture();
        const textured = new MeshStandardMaterial({ map: texture });
        const first = new MeshBasicMaterial();
        const second = new MeshBasicMaterial();
        const group = new Group();
        group.add(new Mesh(geometry, textured), new Mesh(geometry, [first, second]));

        const spies = [geometry, texture, textured, first, second].map((thing) => vi.spyOn(thing, 'dispose'));
        disposeObject(group);

        for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    });

    it('keeps a texture a cached file shares with every clone', () => {
        const shared = new Texture();
        shared.userData.shared = true;
        const own = new Texture();
        const keep = vi.spyOn(shared, 'dispose');
        const free = vi.spyOn(own, 'dispose');
        disposeObject(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ normalMap: shared, map: own })));
        expect(keep).not.toHaveBeenCalled();
        expect(free).toHaveBeenCalledTimes(1);
    });

    it('disposes textures a material keeps only for its shader', () => {
        const kit = new Texture();
        const material = new MeshStandardMaterial();
        material.userData.textures = [kit];
        const spy = vi.spyOn(kit, 'dispose');
        disposeObject(new Mesh(new BoxGeometry(), material));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("disposes each skinned mesh's skeleton once, which frees its bone texture", () => {
        const skeleton = new Skeleton([new Bone()]);
        const group = new Group();
        for (let i = 0; i < 2; i++) {
            const mesh = new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial());
            mesh.bind(skeleton);
            group.add(mesh);
        }
        const spy = vi.spyOn(skeleton, 'dispose');
        disposeObject(group);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('ignores non-mesh nodes', () => {
        const group = new Group();
        group.add(new Object3D());
        expect(() => disposeObject(group)).not.toThrow();
    });
});
