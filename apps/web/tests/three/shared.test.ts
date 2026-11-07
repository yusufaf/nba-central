import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Texture } from 'three';
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

    it('ignores non-mesh nodes', () => {
        const group = new Group();
        group.add(new Object3D());
        expect(() => disposeObject(group)).not.toThrow();
    });
});
