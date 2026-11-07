import { describe, expect, it } from 'vitest';
import { Box3, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { COURT_DEPTH_M, COURT_LENGTH_M, buildCourt } from '@/three/arena/court';

const floorOf = (texture: Texture | null) => {
    const court = buildCourt(texture);
    return court.getObjectByName('court-floor') as Mesh;
};

describe('buildCourt', () => {
    it('sizes the floor to the SVG court', () => {
        const floor = floorOf(new Texture());
        floor.updateMatrixWorld(true);
        const size = new Box3().setFromObject(floor).getSize(new Vector3());
        expect(size.x).toBeCloseTo(COURT_LENGTH_M, 5);
        expect(size.z).toBeCloseTo(COURT_DEPTH_M, 5);
    });

    it('still builds without a texture', () => {
        expect((floorOf(null).material as MeshStandardMaterial).map).toBeNull();
    });
});
