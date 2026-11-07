import { toCanvas } from 'html-to-image';

// Draws a rendered CourtFloor into a canvas for the 3D floor texture.
// html-to-image inlines the SVG's <image> logo and drawing, which an SVG
// drawn as a plain image would never load. A cross-origin image that slips
// through taints the canvas, and WebGL then refuses the texture, so one
// pixel is read back to prove it's clean. Any failure is null: the caller
// retries with fewer images.
export const rasteriseCourt = async (node: HTMLElement): Promise<HTMLCanvasElement | null> => {
    try {
        const canvas = await toCanvas(node, { pixelRatio: 2, cacheBust: true });
        canvas.getContext('2d')?.getImageData(0, 0, 1, 1);
        return canvas;
    } catch {
        return null;
    }
};
