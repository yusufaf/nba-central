import {
    CanvasTexture,
    Group,
    Mesh,
    MeshStandardMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    type Texture,
    type WebGLRenderer,
} from 'three';
import { SCENE_COLOURS } from './palette';

// The SVG court (CourtFloor) is 104 x 58 ft including its apron band.
export const COURT_LENGTH_M = 104 * 0.3048;
export const COURT_DEPTH_M = 58 * 0.3048;

// How far the dark floor runs past the court, out to the first row of seats.
const SURROUND_MARGIN_M = 5.5;

export const courtTexture = (canvas: HTMLCanvasElement, renderer: WebGLRenderer): CanvasTexture => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
};

export const buildCourt = (texture: Texture | null): Group => {
    const group = new Group();

    const surround = new Mesh(
        new PlaneGeometry(COURT_LENGTH_M + 2 * SURROUND_MARGIN_M, COURT_DEPTH_M + 2 * SURROUND_MARGIN_M),
        new MeshStandardMaterial({ color: SCENE_COLOURS.surround, roughness: 0.95 }),
    );
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.01;
    group.add(surround);

    const floor = new Mesh(
        new PlaneGeometry(COURT_LENGTH_M, COURT_DEPTH_M),
        new MeshStandardMaterial({
            map: texture,
            color: texture ? '#ffffff' : SCENE_COLOURS.defaultFloor,
            roughness: 0.38,
        }),
    );
    floor.name = 'court-floor';
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    return group;
};
