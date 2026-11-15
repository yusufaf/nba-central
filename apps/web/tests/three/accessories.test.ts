import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SkinnedMesh, SphereGeometry, Vector3, type Bone } from 'three';
import { ACCESSORIES, POSES, type AccessoryId } from '@/constants/appearance';
import { reshapeBody } from '@/three/character/reshape';
import { POSE_BUILDERS } from '@/three/character/poses';
import { surfacedBody } from './fixtures/skeleton';

const merge = vi.hoisted(() => ({ actual: null as null | ((geometries: BufferGeometry[]) => BufferGeometry | null) }));
vi.mock('three/addons/utils/BufferGeometryUtils.js', async (original) => {
    const actual = await original<typeof import('three/addons/utils/BufferGeometryUtils.js')>();
    merge.actual = actual.mergeGeometries;
    return { ...actual, mergeGeometries: vi.fn(actual.mergeGeometries) };
});

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
    ACCESSORY_BUILDERS,
    attachAccessories,
    eyewearParts,
    farthestHit,
    fitForearm,
    fitHead,
    wrapBand,
    type Triangles,
} from '@/three/character/accessories';

const FORWARD = new Vector3(0, 0, 1);
const HEAD_CENTRE = new Vector3(0, 1.81, 0); // the fixture's head sphere
const SPHERE = 0.1 * Math.cos(Math.PI / 16); // its faceted inner radius
const GLASSES = { lens: 0.021, tube: 0.0028, clearance: 0.004, back: 'temples' as const };
const GOGGLES = { lens: 0.025, tube: 0.0055, clearance: 0.006, back: 'strap' as const };

const bodyOf = (root: Group) => root.children.find((c): c is SkinnedMesh => c.name === 'Body')!;
const trianglesOf = (geometry: BufferGeometry): Triangles => {
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex()!;
    return new Float32Array(Array.from({ length: index.count }, (_, i) => [0, 1, 2].map((k) => position.getComponent(index.getX(i), k))).flat());
};
const vertices = (geometry: BufferGeometry, transform?: Mesh): Vector3[] => {
    const position = geometry.getAttribute('position');
    return Array.from({ length: position.count }, (_, v) => {
        const p = new Vector3().fromBufferAttribute(position, v);
        return transform ? p.applyMatrix4(transform.matrixWorld) : p;
    });
};
// The band's own rings, without the two tucked under the surface.
const untucked = (geometry: BufferGeometry, segments: number) => {
    const all = vertices(geometry);
    const rings = all.length / segments;
    return all.filter((_, v) => Math.floor(v / segments) > 0 && Math.floor(v / segments) < rings - 1);
};
const fromAxis = (p: Vector3, origin: Vector3, axis: Vector3) => {
    const d = p.clone().sub(origin);
    return d.addScaledVector(axis, -d.dot(axis)).length();
};
const nearest = (a: Vector3[], b: Vector3[]) => Math.min(...a.map((p) => Math.min(...b.map((q) => p.distanceTo(q)))));
const worn = (...ids: AccessoryId[]) => ids.map((id, i) => ({ id, color: ['#c8102e', '#1d428a', '#007a33', '#fdb927'][i] }));
const gear = (root: Group) => {
    const found: Mesh[] = [];
    root.traverse((node) => node.name.startsWith('accessory-') && found.push(node as Mesh));
    return found;
};
const headFit = (root = surfacedBody()) => fitHead(root, bodyOf(root), FORWARD)!;

afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(mergeGeometries).mockImplementation(merge.actual!);
});

describe('farthestHit', () => {
    const sphere = trianglesOf(new SphereGeometry(0.1, 24, 16));

    it('finds the surface from inside', () => {
        for (const direction of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
            const distance = farthestHit(sphere, new Vector3(), direction)!;
            expect(distance).toBeGreaterThanOrEqual(SPHERE - 1e-6);
            expect(distance).toBeLessThanOrEqual(0.1 + 1e-6);
        }
    });

    it('is null for a ray that leaves the surface behind', () => {
        expect(farthestHit(sphere, new Vector3(0.5, 0, 0), new Vector3(1, 0, 0))).toBeNull();
    });
});

describe('wrapBand', () => {
    const cylinder = trianglesOf(new CylinderGeometry(0.04, 0.04, 0.25, 16, 1, true));
    const frame = { origin: new Vector3(), axis: new Vector3(0, 1, 0), start: new Vector3(1, 0, 0) };
    const options = { from: -0.1, to: 0.1, stations: 4, segments: 16, lift: 0.003 };

    it('rings the surface just clear of it, with tucked edges', () => {
        const band = wrapBand(cylinder, frame, options)!;
        for (const p of untucked(band, 16)) expect(fromAxis(p, frame.origin, frame.axis)).toBeGreaterThanOrEqual(0.04 * Math.cos(Math.PI / 16) + 0.003 - 1e-4);
        const all = vertices(band);
        const tucked = [...all.slice(0, 16), ...all.slice(-16)];
        for (const p of tucked) expect(fromAxis(p, frame.origin, frame.axis)).toBeLessThan(0.04);
        expect(band.getIndex()!.count / 3).toBe((options.stations + 2 - 1) * 16 * 2);
    });

    it('leaves an arc open, with every position finite', () => {
        const band = wrapBand(cylinder, frame, { ...options, arc: { start: -Math.PI / 2, length: Math.PI } })!;
        const index = band.getIndex()!;
        for (let t = 0; t < index.count; t += 3) {
            const js = [0, 1, 2].map((k) => index.getX(t + k) % 16);
            expect(js.includes(0) && js.includes(15)).toBe(false);
        }
        expect(Array.from(band.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    });

    it('raises each radius to the largest of its 3x3 neighbours, around and along', () => {
        // A plate 6 cm out, met only by station 1's ray at angle 0.
        const plate = new Float32Array([0.06, -0.04, -0.003, 0.06, -0.027, -0.003, 0.06, -0.04, 0.003, 0.06, -0.027, -0.003, 0.06, -0.027, 0.003, 0.06, -0.04, 0.003]);
        const band = wrapBand(Float32Array.from([...cylinder, ...plate]), frame, options)!;
        const all = vertices(band);
        const radius = (station: number, j: number) => fromAxis(all[(station + 1) * 16 + ((j + 16) % 16)], frame.origin, frame.axis);
        for (const station of [0, 1, 2]) {
            for (const j of [-1, 0, 1]) expect(radius(station, j)).toBeCloseTo(0.063, 4);
            for (const j of [2, -2]) expect(radius(station, j)).toBeLessThan(0.05);
        }
        for (let j = 0; j < 16; j++) expect(radius(3, j)).toBeLessThan(0.05);
    });

    it('is null with nothing to wrap', () => {
        expect(wrapBand(new Float32Array(), frame, options)).toBeNull();
    });

    it('fills a ring that misses from its nearest neighbour, measuring from the origin', () => {
        const short = trianglesOf(new CylinderGeometry(0.04, 0.04, 0.12, 16, 1, true).translate(0, 0.05, 0));
        const band = wrapBand(short, frame, { ...options, from: -0.1, to: 0.1 })!;
        expect(band).not.toBeNull();
        const moved = wrapBand(short, { ...frame, origin: new Vector3(0, 1, 0) }, { ...options, from: -1.1, to: -0.9 })!;
        const a = vertices(band);
        const b = vertices(moved);
        a.forEach((p, i) => expect(p.distanceTo(b[i])).toBeLessThan(1e-5));
    });
});

describe('fits', () => {
    it('reads the head and right forearm', () => {
        const fit = headFit();
        expect(fit.bone.name).toBe('Head');
        expect(fit.right.x).toBeCloseTo(1);
        expect(fit.eyes[0].x).toBeCloseTo(0.035, 2);
        expect(fit.eyes[1].x).toBeCloseTo(-0.035, 2);
        const root = surfacedBody();
        const arm = fitForearm(root, bodyOf(root), 'r')!;
        expect(arm.bone.name).toBe('lowerarm_r');
        expect(arm.wrist.distanceTo(arm.elbow)).toBeCloseTo(0.25);
    });
});

describe('builders', () => {
    it('puts each accessory on the head or the forearm', () => {
        expect(Object.fromEntries(ACCESSORIES.map((id) => [id, ACCESSORY_BUILDERS[id].part]))).toEqual({
            headband: 'head',
            armSleeve: 'forearm',
            goggles: 'head',
            glasses: 'head',
        });
    });

    it('fits the headband and the goggles strap round the head, clear of it', () => {
        const fit = headFit();
        for (const p of untucked(ACCESSORY_BUILDERS.headband.build(fit as never)!, 32)) expect(p.distanceTo(HEAD_CENTRE)).toBeGreaterThanOrEqual(SPHERE);
        const goggles = eyewearParts(fit, GOGGLES)!;
        for (const p of untucked(goggles.strap, 20)) expect(p.distanceTo(HEAD_CENTRE)).toBeGreaterThanOrEqual(SPHERE);
        for (const parts of [goggles, eyewearParts(fit, GLASSES)!]) {
            for (const [name, part] of Object.entries(parts)) {
                if (name === 'strap') continue;
                for (const p of vertices(part)) expect(p.distanceTo(HEAD_CENTRE), name).toBeGreaterThanOrEqual(SPHERE);
            }
        }
    });

    it('fits the headband and the strap over the hair', () => {
        const fit = headFit(surfacedBody({ hair: 0.115 }));
        const hair = 0.115 * Math.cos(Math.PI / 16);
        for (const p of untucked(ACCESSORY_BUILDERS.headband.build(fit as never)!, 32)) expect(p.distanceTo(HEAD_CENTRE)).toBeGreaterThanOrEqual(hair);
        for (const p of untucked(eyewearParts(fit, GOGGLES)!.strap, 20)) expect(p.distanceTo(HEAD_CENTRE)).toBeGreaterThanOrEqual(hair);
    });

    it('fits the sleeve round the forearm, clear of it', () => {
        const root = surfacedBody();
        const arm = fitForearm(root, bodyOf(root), 'r')!;
        const axis = arm.wrist.clone().sub(arm.elbow).normalize();
        for (const p of untucked(ACCESSORY_BUILDERS.armSleeve.build(arm as never)!, 16)) {
            expect(fromAxis(p, arm.elbow, axis)).toBeGreaterThanOrEqual(0.04 * Math.cos(Math.PI / 16));
        }
    });

    it('centres the glasses on the eyes, in front of the face, with temples that meet the rims', () => {
        const fit = headFit();
        const parts = eyewearParts(fit, GLASSES)!;
        const depth = (p: Vector3) => p.clone().sub(fit.centre).dot(fit.forward);
        let rimDepth = 0;
        for (const [i, rim] of [parts.rimL, parts.rimR].entries()) {
            const points = vertices(rim);
            const centroid = points.reduce((s, p) => s.add(p), new Vector3()).divideScalar(points.length);
            expect(Math.abs(centroid.x - fit.eyes[i].x)).toBeLessThan(0.003);
            expect(Math.abs(centroid.y - fit.eyes[i].y)).toBeLessThan(0.003);
            expect(depth(centroid)).toBeGreaterThan(0.102); // the eyes' front
            expect(depth(centroid)).toBeGreaterThan(0.1); // the brows' front
            rimDepth = depth(centroid);
        }
        for (const [temple, rim] of [
            [parts.templeL, parts.rimL],
            [parts.templeR, parts.rimR],
        ]) {
            for (const p of vertices(temple)) expect(depth(p)).toBeLessThanOrEqual(rimDepth + GLASSES.tube);
            expect(nearest(vertices(temple), vertices(rim))).toBeLessThan(2 * GLASSES.tube);
        }
    });

    it('joins the goggles strap to the rims with nothing floating', () => {
        const parts = eyewearParts(headFit(), GOGGLES)!;
        for (const [side, rim] of [
            [parts.sideL, parts.rimL],
            [parts.sideR, parts.rimR],
        ]) {
            expect(nearest(vertices(side), vertices(parts.strap))).toBeLessThan(0.008);
            expect(nearest(vertices(side), vertices(rim))).toBeLessThan(2 * GOGGLES.tube);
        }
    });

    it('frees the pieces it built when a fit fails part way', () => {
        const dispose = vi.spyOn(BufferGeometry.prototype, 'dispose');
        // Nothing to the sides of the head: the strap has nowhere to end.
        expect(eyewearParts({ ...headFit(), outer: new Float32Array() }, GOGGLES)).toBeNull();
        expect(dispose.mock.contexts.map((g) => (g as BufferGeometry).type).sort()).toEqual([
            'TorusGeometry',
            'TorusGeometry',
            'TubeGeometry',
        ]);
    });

    it('fits the sleeve to the reshaped forearm', () => {
        const mean: number[] = [];
        for (const girth of [0.86, 1.4]) {
            const root = surfacedBody();
            reshapeBody(root, { girth, shoulders: 1, wingspan: 1 });
            root.updateMatrixWorld(true);
            const arm = fitForearm(root, bodyOf(root), 'r')!;
            const axis = arm.wrist.clone().sub(arm.elbow).normalize();
            const distances = untucked(ACCESSORY_BUILDERS.armSleeve.build(arm as never)!, 16).map((p) => fromAxis(p, arm.elbow, axis));
            for (const d of distances) expect(d).toBeGreaterThanOrEqual(0.04 * Math.pow(girth, 0.8) * Math.cos(Math.PI / 16));
            mean.push(distances.reduce((s, d) => s + d, 0) / distances.length);
        }
        expect(mean[1]).toBeGreaterThan(mean[0]);
    });

    it('keeps every set under its triangle budget', () => {
        const fit = headFit();
        const root = surfacedBody();
        const arm = fitForearm(root, bodyOf(root), 'r')!;
        const triangles = (g: BufferGeometry) => g.getIndex()!.count / 3;
        const band = triangles(ACCESSORY_BUILDERS.headband.build(fit as never)!);
        const sleeve = triangles(ACCESSORY_BUILDERS.armSleeve.build(arm as never)!);
        const goggles = triangles(ACCESSORY_BUILDERS.goggles.build(fit as never)!);
        const glasses = triangles(ACCESSORY_BUILDERS.glasses.build(fit as never)!);
        expect({ band, sleeve, goggles, glasses }).toEqual({ band: 256, sleeve: 224, goggles: 930, glasses: 864 });
        expect(band + sleeve + goggles).toBeLessThanOrEqual(1500);
    });
});

describe('attachAccessories', () => {
    const attached = (ids: AccessoryId[], root = surfacedBody()) => {
        attachAccessories(root, bodyOf(root), worn(...ids), FORWARD);
        root.updateMatrixWorld(true);
        return root;
    };

    it('merges the gear into one mesh per bone, painted in its colours', () => {
        const root = attached(['headband', 'armSleeve', 'goggles', 'glasses']);
        const meshes = gear(root);
        expect(meshes.map((m) => [m.name, m.parent!.name]).sort()).toEqual([
            ['accessory-armSleeve', 'lowerarm_r'],
            ['accessory-head', 'Head'],
        ]);
        for (const mesh of meshes) expect((mesh.material as MeshStandardMaterial).vertexColors).toBe(true);
        const colours = (mesh: Mesh) => {
            const colour = mesh.geometry.getAttribute('color');
            return new Set(Array.from({ length: colour.count }, (_, v) => colour.getX(v).toFixed(4)));
        };
        const head = meshes.find((m) => m.name === 'accessory-head')!;
        const red = (hex: string) => new MeshStandardMaterial({ color: hex }).color.r.toFixed(4);
        expect(colours(head)).toEqual(new Set([red('#c8102e'), red('#007a33')])); // headband and goggles, never the glasses
        expect(colours(meshes.find((m) => m.name === 'accessory-armSleeve')!)).toEqual(new Set([red('#1d428a')]));
        expect((root.getObjectByName('lowerarm_r') as Bone).isBone).toBe(true);
    });

    it.for(POSES)('keeps the gear on its bones in the %s pose', (pose) => {
        const root = attached(['headband', 'armSleeve', 'goggles']);
        POSE_BUILDERS[pose](root, FORWARD);
        root.updateMatrixWorld(true);
        const elbow = root.getObjectByName('lowerarm_r')!.getWorldPosition(new Vector3());
        const wrist = root.getObjectByName('hand_r')!.getWorldPosition(new Vector3());
        const along = wrist.clone().sub(elbow);
        const length = along.length();
        along.normalize();
        const sleeve = gear(root).find((m) => m.name === 'accessory-armSleeve')!;
        for (const p of vertices(sleeve.geometry, sleeve)) {
            const t = p.clone().sub(elbow).dot(along) / length;
            expect(t).toBeGreaterThanOrEqual(0.15);
            expect(t).toBeLessThanOrEqual(0.95);
            expect(fromAxis(p, elbow, along)).toBeLessThanOrEqual(0.04 + 0.0025 + 0.01);
        }
        const headBone = root.getObjectByName('Head')!.getWorldPosition(new Vector3());
        const head = gear(root).find((m) => m.name === 'accessory-head')!;
        for (const p of vertices(head.geometry, head)) expect(p.distanceTo(headBone)).toBeLessThan(0.2);
    });

    it('skips head gear without eyes to fit to, and still adds the sleeve', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const root = surfacedBody();
        root.remove(root.children.find((c) => c.name === 'Eyes')!);
        expect(gear(attached(['headband', 'armSleeve', 'goggles'], root)).map((m) => m.name)).toEqual(['accessory-armSleeve']);
        expect(warn).toHaveBeenCalledTimes(2);
    });

    it('skips the sleeve without a forearm, and still adds the head gear', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const root = surfacedBody();
        root.getObjectByName('lowerarm_r')!.name = 'forearm';
        expect(gear(attached(['headband', 'armSleeve'], root)).map((m) => m.name)).toEqual(['accessory-head']);
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('skips the head gear when its pieces fail to merge', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const root = surfacedBody();
        vi.mocked(mergeGeometries).mockImplementation((geometries, ...rest) =>
            geometries.every((g) => g.hasAttribute('color')) ? null : merge.actual!(geometries, ...(rest as [])),
        );
        expect(gear(attached(['headband', 'armSleeve', 'goggles'], root)).map((m) => m.name)).toEqual(['accessory-armSleeve']);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});
