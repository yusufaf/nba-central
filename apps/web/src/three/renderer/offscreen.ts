import {
    Mesh,
    MeshBasicMaterial,
    OrthographicCamera,
    PlaneGeometry,
    SRGBColorSpace,
    Scene,
    WebGLRenderTarget,
    type Camera,
    type WebGLRenderer,
} from 'three';

// GL reads rows bottom-up; a canvas wants them top-down.
export const flipRows = (pixels: Uint8Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> => {
    const rowBytes = width * 4;
    const flipped = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < height; y++) {
        flipped.set(pixels.subarray(y * rowBytes, (y + 1) * rowBytes), (height - 1 - y) * rowBytes);
    }
    return flipped;
};

// Every 97th pixel plus the last: enough to tell a real frame from an empty buffer.
const isOpaque = (pixels: Uint8Array): boolean => {
    const count = pixels.length / 4;
    for (let i = 0; i < count; i += 97) if (pixels[i * 4 + 3] !== 255) return false;
    return pixels[pixels.length - 1] === 255;
};

// Draws one frame off screen, at its own size, without touching the visible
// canvas's size, pixel ratio or viewport. Rendering into a target skips the
// renderer's output encoding, so the target itself is sRGB: the GPU encodes on
// write, and the bytes read back are what the on-screen canvas would show.
export const renderToImageData = (
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    width: number,
    height: number,
): ImageData => {
    if (renderer.getContext().isContextLost()) throw new Error('WebGL context is lost');
    const target = new WebGLRenderTarget(width, height, { samples: 4, colorSpace: SRGBColorSpace });
    const previous = renderer.getRenderTarget();
    try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixels = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        // The read fails silently (bad format, lost context) and leaves the
        // buffer zeroed; the scene's background is opaque, so a real frame isn't.
        if (renderer.getContext().isContextLost() || !isOpaque(pixels)) {
            throw new Error('Offscreen read returned no pixels');
        }
        return new ImageData(flipRows(pixels, width, height), width, height);
    } finally {
        renderer.setRenderTarget(previous);
        target.dispose();
    }
};

// A flat, unlit plane of one colour filling the view, for checking that
// renderToImageData's output is sRGB (tests/visual).
export const solidColourProbe = (hex: string): { scene: Scene; camera: OrthographicCamera } => {
    const scene = new Scene();
    scene.add(new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial({ color: hex })));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
    camera.position.z = 1;
    return { scene, camera };
};
