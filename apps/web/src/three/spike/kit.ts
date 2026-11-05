// Throwaway spike (#119). Uniforms and suits without hand-made clothing:
//
// - "painted": the body's own material is patched so regions of the rest
//   pose (jersey, shorts, shoes, jacket, trousers) take kit colours. Regions
//   come from skin weights (arms, legs, head, hands) and from horizontal
//   planes through the joints, so hems are straight lines, not triangle steps.
// - "shell": the same regions are lifted off the body as a separate skinned
//   mesh, pushed out along the normals (flared toward the hems), and the
//   body triangles underneath are deleted, so nothing z-fights or pokes out.
//
// Name and number are projected straight onto the chest and back from the
// rest-pose position, so no UV layout is needed.
import {
    BufferAttribute,
    BufferGeometry,
    CanvasTexture,
    Color,
    DoubleSide,
    Matrix4,
    MeshStandardMaterial,
    SRGBColorSpace,
    SkinnedMesh,
    Vector3,
    type WebGLProgramParametersWithUniforms,
} from 'three';

export type KitMode = 'none' | 'painted' | 'shell';
export type KitKind = 'player' | 'suit';

export interface Kit {
    kind: KitKind;
    primary: string;
    secondary: string;
    trim: string;
    name: string;
    number: string;
    teamName: string;
}

export interface Landmarks {
    hipY: number;
    kneeY: number;
    ankleY: number;
    shoulderY: number;
    neckY: number;
    centreX: number;
    shoulderX: number; // half the distance between the shoulder joints
    front: number; // +1 when the character faces +z in geometry space
    frontZ: number; // chest surface depth in front, for the projection split
    height: number;
}

const ARM = /^(upperarm|lowerarm)_/;
const LEG = /^(thigh|calf)_/;
const HEAD = /^(neck_01|Head)$/;
const HAND = /^(hand|index|middle|pinky|ring|thumb)_/;

// Per-vertex region weights: x arm, y leg, z head, w hand.
export const addRegions = (mesh: SkinnedMesh) => {
    const geometry = mesh.geometry;
    const index = geometry.getAttribute('skinIndex') as BufferAttribute;
    const weight = geometry.getAttribute('skinWeight') as BufferAttribute;
    const names = mesh.skeleton.bones.map((bone) => bone.name);
    const regions = new Float32Array(index.count * 4);
    for (let v = 0; v < index.count; v++) {
        for (let k = 0; k < 4; k++) {
            const w = weight.getComponent(v, k);
            if (!w) continue;
            const name = names[index.getComponent(v, k)] ?? '';
            if (ARM.test(name)) regions[v * 4] += w;
            else if (LEG.test(name)) regions[v * 4 + 1] += w;
            else if (HEAD.test(name)) regions[v * 4 + 2] += w;
            else if (HAND.test(name)) regions[v * 4 + 3] += w;
        }
    }
    geometry.setAttribute('aRegion', new BufferAttribute(regions, 4));
};

export const findLandmarks = (mesh: SkinnedMesh): Landmarks => {
    mesh.updateMatrixWorld(true);
    const unbind = new Matrix4().copy(mesh.bindMatrix).invert();
    const at = (name: string) => {
        const bone = mesh.skeleton.bones.find((b) => b.name === name);
        return bone ? bone.getWorldPosition(new Vector3()).applyMatrix4(unbind) : new Vector3();
    };
    const mid = (a: string, b: string) => at(a).add(at(b)).multiplyScalar(0.5);
    const hip = mid('thigh_l', 'thigh_r');
    const knee = mid('calf_l', 'calf_r');
    const ankle = mid('foot_l', 'foot_r');
    const shoulder = mid('upperarm_l', 'upperarm_r');
    const neck = at('neck_01');
    const toe = at('ball_l').sub(at('foot_l'));
    const box = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox!);
    const front = Math.sign(toe.z) || 1;
    return {
        hipY: hip.y,
        kneeY: knee.y,
        ankleY: ankle.y,
        shoulderY: shoulder.y,
        neckY: neck.y,
        centreX: hip.x,
        shoulderX: Math.abs(at('upperarm_l').x - at('upperarm_r').x) / 2,
        front,
        frontZ: hip.z,
        height: box.max.y - box.min.y,
    };
};

// One canvas per character: front of the jersey on the left half, the back
// (name over number) on the right.
export const kitTexture = (kit: Kit): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 1024, 512);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ink = kit.trim;
    if (kit.kind === 'player') {
        ctx.fillStyle = ink;
        ctx.font = '700 64px Inter, sans-serif';
        ctx.fillText(kit.teamName.toUpperCase().slice(0, 12), 256, 150, 440);
        ctx.font = '800 220px Inter, sans-serif';
        ctx.lineWidth = 10;
        ctx.strokeStyle = kit.secondary;
        ctx.strokeText(kit.number, 256, 330);
        ctx.fillText(kit.number, 256, 330);
        ctx.font = '700 70px Inter, sans-serif';
        ctx.fillText(kit.name.toUpperCase().slice(0, 14), 768, 110, 460);
        ctx.font = '800 250px Inter, sans-serif';
        ctx.strokeText(kit.number, 768, 320);
        ctx.fillText(kit.number, 768, 320);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

const KIT_HEADER = /* glsl */ `
uniform float uForceKit;
uniform float uVinylOn;
uniform vec3 uVinyl;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uShoe;
uniform float uSuit;
uniform float uHipY;
uniform float uKneeY;
uniform float uAnkleY;
uniform float uShoulderY;
uniform float uNeckY;
uniform float uCentreX;
uniform float uShoulderX;
uniform float uFront;
uniform float uFrontZ;
uniform float uHeight;
uniform sampler2D uKitTex;
varying vec4 vRegion;
varying vec3 vRest;
float gKit = 0.0;
`;

const KIT_FRAGMENT = /* glsl */ `
{
    float h = uHeight;
    float y = vRest.y;
    float x = vRest.x - uCentreX;
    float isFront = step(0.0, (vRest.z - uFrontZ) * uFront);
    float arm = step(0.5, vRegion.x) * step(uShoulderX * 0.86, abs(x));
    float leg = step(0.5, vRegion.y);
    float head = step(0.5, vRegion.z);
    float hand = step(0.5, vRegion.w);
    float body = (1.0 - head) * (1.0 - hand);
    vec3 base = mix(diffuseColor.rgb, uVinyl, uVinylOn);
    vec3 colour = base;
    float kit = 0.0;
    float shoe = step(y, uAnkleY + 0.035 * h);
    if (uSuit < 0.5) {
        // Jersey: the torso between the hip line and the neck, no sleeves.
        // Straps run up to the neck; the scoop is only at the centre.
        float neckline = uNeckY + 0.01 * h - mix(0.03, 0.09, isFront) * h * (1.0 - smoothstep(0.0, 0.07 * h, abs(x)));
        float jersey = body * (1.0 - arm) * (1.0 - leg) * step(uHipY - 0.04 * h, y) * step(y, neckline);
        // Shorts: hips down to just above the knee.
        float shorts = body * (1.0 - arm) * step(uKneeY + 0.06 * h, y) * step(y, uHipY + 0.02 * h);
        colour = mix(colour, uPrimary, jersey);
        // Side panels and hem stripes in the secondary colour.
        float stripe = shorts * step(abs(abs(x) - 0.11 * h), 0.012 * h);
        colour = mix(colour, mix(uPrimary, uSecondary, stripe), shorts);
        colour = mix(colour, uShoe, shoe);
        kit = max(max(jersey, shorts), shoe);
        // Name and number, projected on the chest and the back.
        float boxW = 0.30 * h;
        float boxH = 0.22 * h;
        float boxY = uShoulderY - 0.20 * h;
        vec2 local = vec2(x / boxW + 0.5, (y - boxY) / boxH);
        if (jersey > 0.5 && local.x > 0.0 && local.x < 1.0 && local.y > 0.0 && local.y < 1.0) {
            vec2 uv = isFront > 0.5 ? vec2(local.x * 0.5, local.y) : vec2((1.0 - local.x) * 0.5 + 0.5, local.y);
            vec4 ink = texture2D(uKitTex, uv);
            colour = mix(colour, ink.rgb, ink.a);
        }
    } else {
        // Suit: jacket over torso and arms, trousers, shoes, shirt and tie.
        float jacket = body * (1.0 - leg) * step(uHipY - 0.07 * h, y);
        float trousers = body * (1.0 - arm) * step(y, uHipY - 0.0 * h) * (1.0 - shoe);
        float vDepth = 0.17 * h;
        float shirt = jacket * isFront * (1.0 - arm) * step(uShoulderY - vDepth, y) * step(abs(x), (y - (uShoulderY - vDepth)) * 0.55);
        float tie = shirt * step(abs(x), 0.012 * h) * step(uShoulderY - vDepth * 0.95, y);
        colour = mix(colour, uPrimary, jacket);
        colour = mix(colour, uPrimary * 0.8, trousers);
        colour = mix(colour, vec3(0.92), shirt);
        colour = mix(colour, uSecondary, tie);
        colour = mix(colour, uShoe, shoe);
        kit = max(max(jacket, trousers), shoe);
    }
    kit = max(kit, uForceKit);
    gKit = kit;
    diffuseColor.rgb = colour;
}
`;

export interface KitMaterialOptions {
    kit: Kit;
    landmarks: Landmarks;
    vinyl: string | null; // a figurine: no skin texture, one matte colour
    forceKit?: boolean; // the shell is all kit
    texture: CanvasTexture;
}

export const applyKitMaterial = (source: MeshStandardMaterial, options: KitMaterialOptions): MeshStandardMaterial => {
    const material = source.clone();
    const { kit, landmarks, vinyl } = options;
    if (vinyl) {
        material.map = null;
        material.roughness = 0.55;
    }
    const uniforms = {
        uForceKit: { value: options.forceKit ? 1 : 0 },
        uVinylOn: { value: vinyl ? 1 : 0 },
        uVinyl: { value: new Color(vinyl ?? '#000000') },
        uPrimary: { value: new Color(kit.primary) },
        uSecondary: { value: new Color(kit.secondary) },
        uShoe: { value: new Color(kit.kind === 'suit' ? '#1c1c1c' : '#f2f2f2') },
        uSuit: { value: kit.kind === 'suit' ? 1 : 0 },
        uHipY: { value: landmarks.hipY },
        uKneeY: { value: landmarks.kneeY },
        uAnkleY: { value: landmarks.ankleY },
        uShoulderY: { value: landmarks.shoulderY },
        uNeckY: { value: landmarks.neckY },
        uCentreX: { value: landmarks.centreX },
        uShoulderX: { value: landmarks.shoulderX },
        uFront: { value: landmarks.front },
        uFrontZ: { value: landmarks.frontZ },
        uHeight: { value: landmarks.height },
        uKitTex: { value: options.texture },
    };
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                '#include <common>\nattribute vec4 aRegion;\nvarying vec4 vRegion;\nvarying vec3 vRest;',
            )
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion;\nvRest = position;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${KIT_HEADER}`)
            .replace('#include <map_fragment>', `#include <map_fragment>\n${KIT_FRAGMENT}`)
            .replace(
                '#include <roughnessmap_fragment>',
                '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.82, gKit);',
            )
            .replace(
                '#include <normal_fragment_maps>',
                '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, gKit * 0.8));',
            );
    };
    material.customProgramCacheKey = () => `kit-${options.forceKit ? 1 : 0}`;
    if (options.forceKit) material.side = DoubleSide;
    return material;
};

// CPU twin of the shader's region test, for the shell.
const inShell = (p: Vector3, region: number[], lm: Landmarks, kind: KitKind): boolean => {
    const [armWeight, leg, head, hand] = region;
    if (head > 0.5 || hand > 0.5) return false;
    const arm = Math.abs(p.x - lm.centreX) >= lm.shoulderX * 0.86 ? armWeight : 0;
    const h = lm.height;
    if (kind === 'suit') {
        return leg <= 0.5 && p.y >= lm.hipY - 0.07 * h;
    }
    const scoop = Math.max(0, 1 - Math.abs(p.x - lm.centreX) / (0.07 * h));
    const jersey = arm <= 0.5 && leg <= 0.5 && p.y >= lm.hipY - 0.04 * h && p.y <= lm.neckY + 0.01 * h - 0.09 * h * scoop;
    const shorts = arm <= 0.5 && p.y >= lm.kneeY + 0.06 * h && p.y <= lm.hipY + 0.02 * h;
    return jersey || shorts;
};

// Lifts the kit regions off the body into their own skinned mesh and
// deletes the body triangles underneath. Returns the shell, unbound.
export const buildShell = (body: SkinnedMesh, lm: Landmarks, kind: KitKind): SkinnedMesh | null => {
    const geometry = body.geometry;
    const index = geometry.getIndex();
    if (!index) return null;
    const position = geometry.getAttribute('position') as BufferAttribute;
    const normal = geometry.getAttribute('normal') as BufferAttribute;
    const regions = geometry.getAttribute('aRegion') as BufferAttribute;
    const p = new Vector3();
    const keep: number[] = [];
    const lifted: number[] = [];
    const inside = new Uint8Array(position.count);
    for (let v = 0; v < position.count; v++) {
        p.fromBufferAttribute(position, v);
        const region = [regions.getX(v), regions.getY(v), regions.getZ(v), regions.getW(v)];
        inside[v] = inShell(p, region, lm, kind) ? 1 : 0;
    }
    for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        if (inside[a] && inside[b] && inside[c]) lifted.push(a, b, c);
        else keep.push(a, b, c);
    }
    if (lifted.length === 0) return null;

    const shell = new BufferGeometry();
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
        shell.setAttribute(name, (attribute as BufferAttribute).clone());
    }
    shell.setIndex(lifted);
    const shellPosition = shell.getAttribute('position') as BufferAttribute;
    const h = lm.height;
    for (let v = 0; v < shellPosition.count; v++) {
        if (!inside[v]) continue;
        p.fromBufferAttribute(position, v);
        // Thicker near the hems, so jersey and shorts read as loose fabric.
        const hemDistance = Math.abs(p.y - (lm.kneeY + 0.06 * h));
        const flare = Math.max(0, 1 - hemDistance / (0.06 * h));
        const offset = 0.008 * h + 0.012 * h * flare;
        shellPosition.setXYZ(
            v,
            p.x + normal.getX(v) * offset,
            p.y + normal.getY(v) * offset,
            p.z + normal.getZ(v) * offset,
        );
    }
    geometry.setIndex(keep);
    const material = body.material as MeshStandardMaterial;
    const mesh = new SkinnedMesh(shell, material);
    mesh.name = `${body.name}-shell`;
    return mesh;
};
