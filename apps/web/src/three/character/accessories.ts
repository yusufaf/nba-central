// A custom person's gear: a headband, an arm sleeve, goggles or glasses.
// The free asset kit has none, so each is built here, fitted to the reshaped
// rest pose by casting rays at the body's own triangles, then attached to
// its bone (head or right forearm) so it rides that bone in every pose.
// Every piece on one bone is painted with vertex colours and merged into a
// single mesh: one draw call per bone, whatever is worn.
import {
    BufferAttribute,
    BufferGeometry,
    CatmullRomCurve3,
    Color,
    Mesh,
    MeshStandardMaterial,
    QuadraticBezierCurve3,
    Ray,
    TorusGeometry,
    TubeGeometry,
    Vector3,
    type Bone,
    type Object3D,
    type SkinnedMesh,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AccessoryId, PersonAppearance } from '@/constants/appearance';
import { shownAccessories } from '@/utils/appearanceOptions';

/** 9 floats per triangle, in rest-pose world space. */
export type Triangles = Float32Array;

const isHead = (name: string) => /^head$/i.test(name);

/** Per vertex, the name of the bone that weighs most on it. */
export const dominantBones = (mesh: SkinnedMesh): string[] => {
    const index = mesh.geometry.getAttribute('skinIndex');
    const weight = mesh.geometry.getAttribute('skinWeight');
    const names: string[] = [];
    for (let v = 0; v < index.count; v++) {
        let best = 0;
        for (let k = 1; k < 4; k++) if (weight.getComponent(v, k) > weight.getComponent(v, best)) best = k;
        names.push(mesh.skeleton.bones[index.getComponent(v, best)]?.name ?? '');
    }
    return names;
};

const restPositions = (mesh: SkinnedMesh): Float32Array => {
    const position = mesh.geometry.getAttribute('position');
    const out = new Float32Array(position.count * 3);
    const p = new Vector3();
    for (let v = 0; v < position.count; v++) {
        p.fromBufferAttribute(position, v).applyMatrix4(mesh.bindMatrix);
        out.set([p.x, p.y, p.z], v * 3);
    }
    return out;
};

/** The mesh's triangles that touch a vertex whose dominant bone passes `keep`. */
export const restTriangles = (mesh: SkinnedMesh, keep: (bone: string) => boolean = () => true): Triangles => {
    const positions = restPositions(mesh);
    const bones = dominantBones(mesh);
    const index = mesh.geometry.getIndex();
    const count = index ? index.count : positions.length / 3;
    const out: number[] = [];
    for (let t = 0; t + 2 < count; t += 3) {
        const v = [0, 1, 2].map((k) => (index ? index.getX(t + k) : t + k));
        if (!v.some((i) => keep(bones[i]))) continue;
        for (const i of v) out.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    }
    return new Float32Array(out);
};

const joined = (...sets: Triangles[]): Triangles => {
    const out = new Float32Array(sets.reduce((n, s) => n + s.length, 0));
    let at = 0;
    for (const set of sets) {
        out.set(set, at);
        at += set.length;
    }
    return out;
};

const ray = new Ray();
const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const hit = new Vector3();

/** How far along `direction` the last surface is, or null when the ray hits nothing. */
export const farthestHit = (triangles: Triangles, origin: Vector3, direction: Vector3): number | null => {
    ray.set(origin, direction.clone().normalize());
    let farthest: number | null = null;
    for (let t = 0; t < triangles.length; t += 9) {
        a.fromArray(triangles, t);
        b.fromArray(triangles, t + 3);
        c.fromArray(triangles, t + 6);
        if (!ray.intersectTriangle(a, b, c, false, hit)) continue;
        const distance = hit.distanceTo(origin);
        if (farthest === null || distance > farthest) farthest = distance;
    }
    return farthest;
};

export interface BandFrame {
    origin: Vector3;
    axis: Vector3;
    /** Angle 0; made perpendicular to `axis`. */
    start: Vector3;
}

export interface BandOptions {
    /** Along `axis`, from `origin`. */
    from: number;
    to: number;
    /** Rings between `from` and `to` (at least 2). */
    stations: number;
    /** Directions per ring. */
    segments: number;
    /** The gap over the surface. */
    lift: number;
    /** Radians; omitted, the band is a closed ring. */
    arc?: { start: number; length: number };
}

const nearestHit = (radii: (number | null)[], j: number, circular: boolean): number | null => {
    for (let step = 1; step < radii.length; step++) {
        for (const k of [j - step, j + step]) {
            const i = circular ? (k + radii.length) % radii.length : k;
            if (i >= 0 && i < radii.length && radii[i] !== null) return radii[i];
        }
    }
    return null;
};

/**
 * A band that hugs the surface: rings of rays cast out from the axis, each
 * placed `lift` over the farthest surface it meets. The first and last rings
 * are tucked under the surface, so the band's edges read as a thick rim.
 * Null when no ray hits anything.
 */
export const wrapBand = (triangles: Triangles, frame: BandFrame, options: BandOptions): BufferGeometry | null => {
    const { from, to, stations, segments, lift, arc } = options;
    if (triangles.length === 0) return null;
    const axis = frame.axis.clone().normalize();
    const start = frame.start.clone().addScaledVector(axis, -frame.start.dot(axis)).normalize();
    const side = new Vector3().crossVectors(axis, start);
    const directions = Array.from({ length: segments }, (_, j) => {
        const theta = arc ? arc.start + (arc.length * j) / (segments - 1) : (2 * Math.PI * j) / segments;
        return start.clone().multiplyScalar(Math.cos(theta)).addScaledVector(side, Math.sin(theta));
    });

    // Each triangle's extent along the axis, so a ring only tests the ones it can meet.
    const count = triangles.length / 9;
    const low = new Float32Array(count);
    const high = new Float32Array(count);
    const offset = new Vector3();
    for (let t = 0; t < count; t++) {
        let min = Infinity;
        let max = -Infinity;
        for (let k = 0; k < 3; k++) {
            const s = offset.fromArray(triangles, t * 9 + k * 3).sub(frame.origin).dot(axis);
            min = Math.min(min, s);
            max = Math.max(max, s);
        }
        low[t] = min;
        high[t] = max;
    }

    const at = Array.from({ length: stations }, (_, k) => from + ((to - from) * k) / (stations - 1));
    const hits = at.map((s) => {
        const near: number[] = [];
        for (let t = 0; t < count; t++) {
            if (low[t] <= s && s <= high[t]) for (let k = 0; k < 9; k++) near.push(triangles[t * 9 + k]);
        }
        const subset = new Float32Array(near);
        const centre = frame.origin.clone().addScaledVector(axis, s);
        const radii = directions.map((direction) => farthestHit(subset, centre, direction));
        if (radii.every((r) => r === null)) return null;
        return radii.map((r, j) => r ?? nearestHit(radii, j, !arc)!);
    });
    if (hits.every((radii) => radii === null)) return null;
    // A ring that hit nothing copies the nearest one that did.
    const filled = hits.map((radii, k) => {
        for (let step = 0; !radii; step++) radii = hits[k - step] ?? hits[k + step];
        return radii;
    });
    // Each radius takes the largest of its neighbours, around and along, so a
    // strand of hair that sits between two rays still ends up under the band.
    // An arc's ends have no neighbour past them.
    const rings = filled.map((r, k) =>
        r.map((_, j) => {
            let most = 0;
            for (const ring of [filled[k - 1], r, filled[k + 1]]) {
                if (!ring) continue;
                for (const step of [-1, 0, 1]) {
                    const i = j + step;
                    if (arc && (i < 0 || i >= segments)) continue;
                    most = Math.max(most, ring[(i + segments) % segments]);
                }
            }
            return most;
        }),
    );

    const layout: { s: number; radii: number[]; off: number }[] = [
        { s: at[0], radii: rings[0], off: -lift },
        ...rings.map((radii, k) => ({ s: at[k], radii, off: lift })),
        { s: at[stations - 1], radii: rings[stations - 1], off: -lift },
    ];
    const positions: number[] = [];
    const uvs: number[] = [];
    const point = new Vector3();
    layout.forEach(({ s, radii, off }, i) => {
        directions.forEach((direction, j) => {
            point.copy(frame.origin).addScaledVector(axis, s).addScaledVector(direction, radii[j] + off);
            positions.push(point.x, point.y, point.z);
            uvs.push(i / (layout.length - 1), j / (arc ? segments - 1 : segments));
        });
    });
    const indices: number[] = [];
    const around = arc ? segments - 1 : segments;
    for (let i = 0; i < layout.length - 1; i++) {
        for (let j = 0; j < around; j++) {
            const p = i * segments + j;
            const q = i * segments + ((j + 1) % segments);
            const r = p + segments;
            const t = q + segments;
            indices.push(p, q, r, q, t, r);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
};

const skinnedIn = (root: Object3D): SkinnedMesh[] => {
    const meshes: SkinnedMesh[] = [];
    root.traverse((node) => {
        if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
    });
    return meshes;
};

const boneNamed = (root: Object3D, test: (name: string) => boolean): Bone | null => {
    let found: Bone | null = null;
    root.traverse((node) => {
        if (!found && (node as Bone).isBone && test(node.name)) found = node as Bone;
    });
    return found;
};

const materialName = (mesh: SkinnedMesh) => (Array.isArray(mesh.material) ? '' : mesh.material.name);

export interface HeadFit {
    bone: Bone;
    up: Vector3;
    forward: Vector3;
    /** up × forward: the character's left. */
    right: Vector3;
    /** The head bone's side position, at eye height, midway through the head front to back. */
    centre: Vector3;
    /** Eye centres, the character's left first. */
    eyes: [Vector3, Vector3];
    /** Heights along `up`. */
    browTop: number;
    top: number;
    /** The head, eyes, brows and beard: no hair. */
    face: Triangles;
    /** `face` plus the hair. */
    outer: Triangles;
}

export const fitHead = (character: Object3D, body: SkinnedMesh, forward: Vector3): HeadFit | null => {
    const bone = boneNamed(character, isHead);
    const others = skinnedIn(character).filter((mesh) => mesh !== body);
    const eyesMesh = others.find((mesh) => /eye/i.test(materialName(mesh)));
    if (!bone || !eyesMesh) return null;
    const hair = others.filter((mesh) => mesh.name === 'hair');
    const beard = others.filter((mesh) => mesh.name === 'facialHair');
    const brows = others.filter((mesh) => mesh !== eyesMesh && mesh.name !== 'hair' && mesh.name !== 'facialHair' && /hair/i.test(materialName(mesh)));

    const head = restTriangles(body, isHead);
    if (head.length === 0) return null;
    const up = new Vector3(0, 1, 0);
    const front = forward.clone().addScaledVector(up, -forward.dot(up)).normalize();
    const right = new Vector3().crossVectors(up, front);
    const bonePosition = bone.getWorldPosition(new Vector3());

    const positions = restPositions(body);
    const bones = dominantBones(body);
    let top = -Infinity;
    let nearest = Infinity;
    let farthest = -Infinity;
    const p = new Vector3();
    bones.forEach((name, v) => {
        if (!isHead(name)) return;
        p.fromArray(positions, v * 3);
        top = Math.max(top, p.dot(up));
        nearest = Math.min(nearest, p.dot(front));
        farthest = Math.max(farthest, p.dot(front));
    });

    const eyePoints = restPositions(eyesMesh);
    const boxes = [new Vector3(Infinity, Infinity, Infinity), new Vector3(-Infinity, -Infinity, -Infinity)];
    const sides = [boxes.map((v) => v.clone()), boxes.map((v) => v.clone())];
    for (let i = 0; i < eyePoints.length; i += 3) {
        p.fromArray(eyePoints, i);
        const box = sides[p.clone().sub(bonePosition).dot(right) >= 0 ? 0 : 1];
        box[0].min(p);
        box[1].max(p);
    }
    if (sides.some(([min]) => !Number.isFinite(min.x))) return null;
    const eyes = sides.map(([min, max]) => min.clone().add(max).multiplyScalar(0.5)) as [Vector3, Vector3];
    const eyeHeight = (eyes[0].dot(up) + eyes[1].dot(up)) / 2;

    const centre = bonePosition.clone();
    centre.addScaledVector(up, eyeHeight - centre.dot(up));
    centre.addScaledVector(front, (nearest + farthest) / 2 - centre.dot(front));

    let browTop = -Infinity;
    for (const mesh of brows) {
        const points = restPositions(mesh);
        for (let i = 0; i < points.length; i += 3) browTop = Math.max(browTop, p.fromArray(points, i).dot(up));
    }
    if (!Number.isFinite(browTop)) browTop = eyeHeight + 0.25 * (top - eyeHeight);

    const face = joined(head, ...[eyesMesh, ...brows, ...beard].map((mesh) => restTriangles(mesh)));
    const outer = joined(face, ...hair.map((mesh) => restTriangles(mesh)));
    return { bone, up, forward: front, right, centre, eyes, browTop, top, face, outer };
};

export interface ForearmFit {
    bone: Bone;
    elbow: Vector3;
    wrist: Vector3;
    surface: Triangles;
}

export const fitForearm = (character: Object3D, body: SkinnedMesh, side: 'l' | 'r'): ForearmFit | null => {
    const bone = boneNamed(character, (name) => name === `lowerarm_${side}`);
    const hand = boneNamed(character, (name) => name === `hand_${side}`);
    if (!bone || !hand) return null;
    const surface = restTriangles(body, (name) => name === `lowerarm_${side}`);
    if (surface.length === 0) return null;
    return { bone, elbow: bone.getWorldPosition(new Vector3()), wrist: hand.getWorldPosition(new Vector3()), surface };
};

export interface EyewearSpec {
    lens: number;
    tube: number;
    clearance: number;
    back: 'temples' | 'strap';
}

const GLASSES: EyewearSpec = { lens: 0.021, tube: 0.0028, clearance: 0.004, back: 'temples' };
const GOGGLES: EyewearSpec = { lens: 0.025, tube: 0.0055, clearance: 0.006, back: 'strap' };

/**
 * The pieces of a pair of glasses or goggles, or null when they can't be fitted
 * (anything built by then is freed). The caller owns the pieces it gets back.
 * Exported for tests.
 */
export const eyewearParts = (fit: HeadFit, spec: EyewearSpec): Record<string, BufferGeometry> | null => {
    const { centre, up, forward, right, eyes, face, outer } = fit;
    const { lens, tube, clearance } = spec;
    const depthOf = (point: Vector3) => point.clone().sub(centre).dot(forward);
    const atDepth = (point: Vector3, depth: number) => point.clone().addScaledVector(forward, depth - depthOf(point));

    // The rims sit just clear of whatever is in front of the face around the eyes.
    let faceDepth = -Infinity;
    for (const eye of eyes) {
        for (let k = 0; k < 16; k++) {
            const angle = (2 * Math.PI * k) / 16;
            const around = eye
                .clone()
                .addScaledVector(right, Math.cos(angle) * (lens + tube))
                .addScaledVector(up, Math.sin(angle) * (lens + tube));
            const distance = farthestHit(face, atDepth(around, 0), forward);
            if (distance !== null) faceDepth = Math.max(faceDepth, distance);
        }
    }
    if (!Number.isFinite(faceDepth)) return null;
    const rimDepth = faceDepth + clearance + tube;
    const lenses = eyes.map((eye) => atDepth(eye, rimDepth));

    const parts: Record<string, BufferGeometry> = {};
    // A fit that fails part way frees what it already built.
    const failed = () => {
        for (const part of Object.values(parts)) part.dispose();
        return null;
    };
    lenses.forEach((at, i) => {
        parts[i === 0 ? 'rimL' : 'rimR'] = new TorusGeometry(lens, tube, 6, 20)
            .lookAt(forward)
            .translate(at.x, at.y, at.z);
    });

    const inner = lenses.map((at, i) => at.clone().addScaledVector(right, i === 0 ? -lens : lens).addScaledVector(up, 0.004));
    const mid = inner[0].clone().add(inner[1]).multiplyScalar(0.5);
    const nose = farthestHit(face, centre.clone().addScaledVector(up, 0.003), forward);
    const bridgeDepth = nose === null ? rimDepth : Math.max(rimDepth, nose + clearance);
    const control = atDepth(mid, bridgeDepth).multiplyScalar(2).sub(mid);
    parts.bridge = new TubeGeometry(new QuadraticBezierCurve3(inner[0], control, inner[1]), 8, tube * 0.8, 6);

    const sides = [1, -1] as const;
    const hinges = lenses.map((at, i) => at.clone().addScaledVector(right, sides[i] * lens));
    // Where an arm's centre line sits at this depth and height: its tube clears
    // the surface by `clearance`, and it is never inside the hinge's width.
    const outAt = (tris: Triangles, outward: Vector3, hingeOut: number, depth: number, height: number) => {
        const origin = centre.clone().addScaledVector(forward, depth).addScaledVector(up, height);
        const surface = farthestHit(tris, origin, outward);
        const out = surface === null ? hingeOut : Math.max(hingeOut, surface + clearance + tube * 0.8);
        return origin.addScaledVector(outward, out);
    };
    const steps = (from: number, to: number, n: number) => Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));

    for (const [i, sign] of sides.entries()) {
        const outward = right.clone().multiplyScalar(sign);
        const hinge = hinges[i];
        const hingeOut = hinge.clone().sub(centre).dot(outward);
        const hingeUp = hinge.clone().sub(centre).dot(up);
        const suffix = i === 0 ? 'L' : 'R';
        if (spec.back === 'temples') {
            const earDepth = -0.02;
            const points = [hinge, ...steps(rimDepth - 0.015, earDepth, 4).map((d) => outAt(face, outward, hingeOut, d, hingeUp))];
            const last = points[points.length - 1];
            points.push(last.clone().addScaledVector(forward, -0.012).addScaledVector(up, -0.012));
            parts[`temple${suffix}`] = new TubeGeometry(new CatmullRomCurve3(points), 12, tube * 0.8, 6);
        } else {
            const strapHeight = 0.006;
            const reach = farthestHit(outer, centre.clone().addScaledVector(up, strapHeight), outward);
            if (reach === null) return failed();
            // The side piece's tube ends resting on the strap.
            const end = centre.clone().addScaledVector(up, strapHeight).addScaledVector(outward, reach + 0.002 + tube * 0.8);
            const middle = steps(rimDepth - 0.015, 0.015, 3).map((d, k) =>
                outAt(outer, outward, hingeOut, d, hingeUp + (strapHeight - hingeUp) * ((k + 1) / 3)),
            );
            parts[`side${suffix}`] = new TubeGeometry(new CatmullRomCurve3([hinge, ...middle, end]), 10, tube * 0.8, 6);
        }
    }
    if (spec.back === 'strap') {
        const strap = wrapBand(
            outer,
            { origin: centre, axis: up, start: forward.clone().negate() },
            { from: 0, to: 0.012, stations: 2, segments: 20, lift: 0.002, arc: { start: -Math.PI / 2, length: Math.PI } },
        );
        if (!strap) return failed();
        parts.strap = strap;
    }
    return parts;
};

const mergedOrNull = (geometries: BufferGeometry[]): BufferGeometry | null => {
    const merged = mergeGeometries(geometries);
    for (const geometry of geometries) geometry.dispose();
    return merged;
};

const eyewear = (spec: EyewearSpec) => (fit: HeadFit) => {
    const parts = eyewearParts(fit, spec);
    return parts && mergedOrNull(Object.values(parts));
};

type Builder =
    | { part: 'head'; build: (fit: HeadFit) => BufferGeometry | null }
    | { part: 'forearm'; build: (fit: ForearmFit) => BufferGeometry | null };

export const ACCESSORY_BUILDERS: Record<AccessoryId, Builder> = {
    headband: {
        part: 'head',
        build: ({ centre, up, right, browTop, top, outer }) => {
            const height = browTop + 0.3 * (top - browTop) - centre.dot(up);
            const half = 0.15 * (top - browTop);
            return wrapBand(outer, { origin: centre, axis: up, start: right }, { from: height - half, to: height + half, stations: 3, segments: 32, lift: 0.003 });
        },
    },
    armSleeve: {
        part: 'forearm',
        build: ({ elbow, wrist, surface }) => {
            const along = wrist.clone().sub(elbow);
            const length = along.length();
            along.normalize();
            const start = new Vector3(0, 0, 1).addScaledVector(along, -along.z);
            if (start.lengthSq() < 1e-8) start.set(0, 1, 0);
            return wrapBand(surface, { origin: elbow, axis: along, start }, { from: 0.2 * length, to: 0.9 * length, stations: 6, segments: 16, lift: 0.0025 });
        },
    },
    goggles: { part: 'head', build: eyewear(GOGGLES) },
    glasses: { part: 'head', build: eyewear(GLASSES) },
};

export const PART_ROUGHNESS = { head: 0.6, forearm: 0.8 } as const;

/** Gives every vertex `color` (in the linear working space, as `Color` stores it). */
export const paint = (geometry: BufferGeometry, color: string): BufferGeometry => {
    const { r, g, b: blue } = new Color(color);
    const count = geometry.getAttribute('position').count;
    const colours = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) colours.set([r, g, blue], v * 3);
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    return geometry;
};

const MESH_NAMES = { head: 'accessory-head', forearm: 'accessory-armSleeve' } as const;

/**
 * Builds the worn gear on a reshaped character still in its rest pose, and
 * attaches it to its bones. A piece that can't be fitted is skipped with a
 * warning; it never fails the person.
 */
export const attachAccessories = (character: Object3D, body: SkinnedMesh, worn: PersonAppearance['accessories'], forward: Vector3): void => {
    let head: HeadFit | null | undefined;
    let arm: ForearmFit | null | undefined;
    const pieces = { head: [] as BufferGeometry[], forearm: [] as BufferGeometry[] };
    for (const { id, color } of shownAccessories(worn)) {
        try {
            const entry = ACCESSORY_BUILDERS[id];
            let geometry: BufferGeometry | null;
            if (entry.part === 'head') {
                if (head === undefined) head = fitHead(character, body, forward);
                geometry = head && entry.build(head);
            } else {
                if (arm === undefined) arm = fitForearm(character, body, 'r');
                geometry = arm && entry.build(arm);
            }
            if (!geometry) {
                console.warn(`Skipped the ${id}: nothing on this body to fit it to`);
                continue;
            }
            pieces[entry.part].push(paint(geometry, color));
        } catch (error) {
            console.warn(`Skipped the ${id}`, error);
        }
    }
    for (const part of ['head', 'forearm'] as const) {
        const fit = part === 'head' ? head : arm;
        const list = pieces[part];
        if (!fit || list.length === 0) continue;
        const geometry = list.length === 1 ? list[0] : mergedOrNull(list);
        if (!geometry) {
            console.warn(`Skipped the ${part} gear: its pieces didn't merge`);
            continue;
        }
        const mesh = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: PART_ROUGHNESS[part] }));
        mesh.name = MESH_NAMES[part];
        fit.bone.attach(mesh);
    }
};
