// Uniforms and staff outfits painted straight onto the body (spec decision 16): the
// body's material is patched so regions of the rest pose take kit colours.
// Regions come from skin weights (arms, legs, head, hands) and horizontal
// planes through the joints, so hems are straight lines. Text is projected
// onto the chest from the rest pose, so no UV layout is needed.
import {
    BufferAttribute,
    CanvasTexture,
    Color,
    Matrix4,
    MeshStandardMaterial,
    SRGBColorSpace,
    Vector3,
    type SkinnedMesh,
    type WebGLProgramParametersWithUniforms,
} from 'three';
import type { OutfitStyleId } from '@/constants/appearance';
import type { KitColours } from '@/utils/jerseyColours';

export type KitKind = 'player' | OutfitStyleId;

const OUTFIT_INDEX: Record<KitKind, number> = { player: 0, suit: 1, polo: 2, tracksuit: 3 };

export interface Landmarks {
    hipY: number;
    kneeY: number;
    ankleY: number;
    shoulderY: number;
    neckY: number;
    centreX: number;
    shoulderX: number; // half the distance between the shoulder joints
    elbowX: number; // the left elbow's distance from the centre line
    front: number; // +1 when the body faces +z in geometry space
    frontZ: number; // depth that splits front from back
    height: number;
}

// Staff outfits take their primary and secondary from the look (a suit's
// secondary is its tie); shoes and polo trousers are fixed.
const SHOE = '#1c1c1c';
const SLACKS = '#2e3138';
const SNEAKER = '#f2f2f2';

const ARM = /^(upperarm|lowerarm)_/;
const LEG = /^(thigh|calf)_/;
const HEAD = /^(neck_01|Head)$/;
const HAND = /^(hand|index|middle|pinky|ring|thumb)_/;

// Per-vertex region weights: x arm, y leg, z head, w hand.
export const addRegions = (mesh: SkinnedMesh): void => {
    const geometry = mesh.geometry;
    const index = geometry.getAttribute('skinIndex');
    const weight = geometry.getAttribute('skinWeight');
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
    const toe = at('ball_l').sub(at('foot_l'));
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    return {
        hipY: hip.y,
        kneeY: mid('calf_l', 'calf_r').y,
        ankleY: mid('foot_l', 'foot_r').y,
        shoulderY: mid('upperarm_l', 'upperarm_r').y,
        neckY: at('neck_01').y,
        centreX: hip.x,
        shoulderX: Math.abs(at('upperarm_l').x - at('upperarm_r').x) / 2,
        elbowX: Math.abs(at('lowerarm_l').x - hip.x),
        front: Math.sign(toe.z) || 1,
        frontZ: hip.z,
        height: box.max.y - box.min.y,
    };
};

// The jersey's lettering on a 1024x512 canvas: the front on the left half,
// the back on the right (mirrored in the shader, so text drawn normally reads
// correctly from behind). The front has the team name, with the number under
// it when there is one; the back has only the number.
export const kitTexture = (kit: {
    kind: KitKind;
    teamName: string;
    number?: string | null;
    trim: string;
    secondary: string;
}): CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context && kit.kind === 'player') {
        context.clearRect(0, 0, 1024, 512);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = kit.secondary;
        context.fillStyle = kit.trim;
        const draw = (text: string, x: number, y: number, size: number, maxWidth: number) => {
            context.font = `800 ${size}px Inter, sans-serif`;
            context.lineWidth = Math.max(6, size / 12);
            context.strokeText(text, x, y, maxWidth);
            context.fillText(text, x, y, maxWidth);
        };
        const name = kit.teamName.toUpperCase().slice(0, 14);
        // Narrower than the half it sits in: the chest is narrower than the box.
        if (kit.number) {
            draw(name, 256, 190, 60, 280);
            draw(kit.number, 256, 360, 150, 190);
            draw(kit.number, 768, 250, 280, 300);
        } else {
            draw(name, 256, 250, 96, 320);
        }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
};

const KIT_HEADER = /* glsl */ `
uniform float uVinylOn;
uniform vec3 uVinyl;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uShoe;
uniform vec3 uSlacks;
uniform float uOutfit;
uniform float uHipY;
uniform float uKneeY;
uniform float uAnkleY;
uniform float uShoulderY;
uniform float uNeckY;
uniform float uCentreX;
uniform float uShoulderX;
uniform float uElbowX;
uniform float uFront;
uniform float uFrontZ;
uniform float uHeight;
uniform sampler2D uKitTex;
varying vec4 vRegion;
varying vec3 vRest;
varying vec3 vRestNormal;
float gKit = 0.0;
`;

const KIT_FRAGMENT = /* glsl */ `
{
    float h = uHeight;
    float y = vRest.y;
    float x = vRest.x - uCentreX;
    float isFront = step(0.0, (vRest.z - uFrontZ) * uFront);
    // Arm-weighted vertices inside the shoulder joints are the jersey's straps.
    float arm = step(0.5, vRegion.x) * step(uShoulderX * 0.86, abs(x));
    float leg = step(0.5, vRegion.y);
    float head = step(0.5, vRegion.z);
    float hand = step(0.5, vRegion.w);
    float body = (1.0 - head) * (1.0 - hand);
    vec3 colour = mix(diffuseColor.rgb, uVinyl, uVinylOn);
    float kit = 0.0;
    float shoe = step(y, uAnkleY + 0.035 * h);
    if (uOutfit < 0.5) {
        // Straps run up to the neck; the scoop is only at the centre.
        float neckline = uNeckY + 0.01 * h - mix(0.03, 0.09, isFront) * h * (1.0 - smoothstep(0.0, 0.07 * h, abs(x)));
        float jersey = body * (1.0 - arm) * (1.0 - leg) * step(uHipY - 0.04 * h, y) * step(y, neckline);
        float shorts = body * (1.0 - arm) * step(uKneeY + 0.06 * h, y) * step(y, uHipY + 0.02 * h);
        float stripe = shorts * step(abs(abs(x) - 0.11 * h), 0.012 * h);
        colour = mix(colour, uPrimary, jersey);
        colour = mix(colour, mix(uPrimary, uSecondary, stripe), shorts);
        colour = mix(colour, uShoe, shoe);
        kit = max(max(jersey, shorts), shoe);
        float boxW = 0.30 * h;
        float boxH = 0.22 * h;
        float boxY = uShoulderY - 0.20 * h;
        vec2 local = vec2(x / boxW + 0.5, (y - boxY) / boxH);
        if (jersey > 0.5 && local.x > 0.0 && local.x < 1.0 && local.y > 0.0 && local.y < 1.0) {
            vec2 uv = isFront > 0.5 ? vec2(local.x * 0.5, local.y) : vec2((1.0 - local.x) * 0.5 + 0.5, local.y);
            vec4 ink = texture2D(uKitTex, uv);
            colour = mix(colour, ink.rgb, ink.a);
        }
    } else if (uOutfit < 1.5) {
        float jacket = body * (1.0 - leg) * step(uHipY - 0.07 * h, y);
        // Leg-weighted skin above the hip line is trouser too, or it shows
        // as a gap at the hips under a custom skin colour.
        float trousers = body * (1.0 - arm) * max(step(y, uHipY), leg) * (1.0 - shoe);
        float vDepth = 0.17 * h;
        float shirt = jacket * isFront * (1.0 - arm) * step(uShoulderY - vDepth, y) * step(abs(x), (y - (uShoulderY - vDepth)) * 0.55);
        float tie = shirt * step(abs(x), 0.012 * h) * step(uShoulderY - vDepth * 0.95, y);
        colour = mix(colour, uPrimary, jacket);
        colour = mix(colour, uPrimary * 0.8, trousers);
        colour = mix(colour, vec3(0.92), shirt);
        colour = mix(colour, uSecondary, tie);
        colour = mix(colour, uShoe, shoe);
        kit = max(max(jacket, trousers), shoe);
    } else {
        // Polo and tracksuit. The rest pose is a T-pose (arms along x, legs
        // down y), so a rest normal finds a sleeve's top and a leg's side.
        float torso = body * (1.0 - arm) * (1.0 - leg) * step(uHipY - 0.05 * h, y);
        // A band round the base of the neck, not the shoulders' tops.
        float collar = torso * step(uNeckY - 0.03 * h, y) * step(abs(x), 0.06 * h);
        float trousers = body * (1.0 - arm) * max(step(y, uHipY), leg) * (1.0 - shoe);
        float sleeves = body * arm;
        vec3 legs = uSlacks;
        if (uOutfit < 2.5) {
            sleeves *= step(abs(x), uShoulderX + 0.45 * (uElbowX - uShoulderX));
        } else {
            float side = step(0.93, vRestNormal.x * sign(x)) * step(0.5, vRegion.y);
            legs = mix(uPrimary, uSecondary, side);
        }
        float ridge = uOutfit > 2.5 ? sleeves * step(0.88, vRestNormal.y) : 0.0;
        float top = max(torso, sleeves);
        colour = mix(colour, uPrimary, top);
        colour = mix(colour, uSecondary, max(collar, ridge));
        colour = mix(colour, legs, trousers);
        colour = mix(colour, uShoe, shoe);
        kit = max(max(top, trousers), shoe);
    }
    gKit = kit;
    diffuseColor.rgb = colour;
}
`;

export interface KitMaterialOptions {
    kind: KitKind;
    colours: KitColours;
    landmarks: Landmarks;
    vinyl: string | null; // a figurine: no skin texture, one matte colour
    texture: CanvasTexture;
}

export const applyKitMaterial = (source: MeshStandardMaterial, options: KitMaterialOptions): MeshStandardMaterial => {
    const material = source.clone();
    const { kind, colours, landmarks, vinyl } = options;
    if (vinyl) {
        material.map = null;
        material.roughness = 0.55;
    }
    const uniforms = {
        uVinylOn: { value: vinyl ? 1 : 0 },
        uVinyl: { value: new Color(vinyl ?? '#000000') },
        uPrimary: { value: new Color(colours.primary) },
        uSecondary: { value: new Color(colours.secondary) },
        uShoe: { value: new Color(kind === 'suit' || kind === 'polo' ? SHOE : SNEAKER) },
        uSlacks: { value: new Color(SLACKS) },
        uOutfit: { value: OUTFIT_INDEX[kind] },
        uHipY: { value: landmarks.hipY },
        uKneeY: { value: landmarks.kneeY },
        uAnkleY: { value: landmarks.ankleY },
        uShoulderY: { value: landmarks.shoulderY },
        uNeckY: { value: landmarks.neckY },
        uCentreX: { value: landmarks.centreX },
        uShoulderX: { value: landmarks.shoulderX },
        uElbowX: { value: landmarks.elbowX },
        uFront: { value: landmarks.front },
        uFrontZ: { value: landmarks.frontZ },
        uHeight: { value: landmarks.height },
        uKitTex: { value: options.texture },
    };
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec4 aRegion;\nvarying vec4 vRegion;\nvarying vec3 vRest;\nvarying vec3 vRestNormal;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion;\nvRest = position;\nvRestNormal = normal;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${KIT_HEADER}`)
            .replace('#include <map_fragment>', `#include <map_fragment>\n${KIT_FRAGMENT}`)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.82, gKit);')
            .replace(
                '#include <normal_fragment_maps>',
                '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, gKit * 0.8));',
            );
    };
    material.customProgramCacheKey = () => `kit-${kind}`;
    // The kit texture is only a shader uniform; disposeObject finds it here.
    material.userData.textures = [options.texture];
    return material;
};
