import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Color, Mesh, MeshBasicMaterial, PerspectiveCamera, SRGBColorSpace, Scene, type WebGLRenderTarget } from 'three';
import { flipRows, renderToImageData, solidColourProbe } from '@/three/renderer/offscreen';

beforeAll(() => {
    // jsdom has no ImageData.
    if (typeof globalThis.ImageData === 'undefined') {
        vi.stubGlobal(
            'ImageData',
            class {
                constructor(
                    public data: Uint8ClampedArray,
                    public width: number,
                    public height: number,
                ) {}
            },
        );
    }
});

const fakeRenderer = ({ opaque = true, lostBefore = false, lostAfterRender = false, renderThrows = false } = {}) => {
    let lost = lostBefore;
    let current: WebGLRenderTarget | null = null;
    const targets: WebGLRenderTarget[] = [];
    const renderer = {
        getContext: () => ({ isContextLost: () => lost }),
        getRenderTarget: vi.fn(() => current),
        setRenderTarget: vi.fn((target: WebGLRenderTarget | null) => {
            current = target;
            if (target) targets.push(target);
        }),
        render: vi.fn(() => {
            if (renderThrows) throw new Error('render failed');
            if (lostAfterRender) lost = true;
        }),
        readRenderTargetPixels: vi.fn(
            (_target: unknown, _x: number, _y: number, _w: number, _h: number, buffer: Uint8Array) => {
                if (opaque && !lost) buffer.fill(255);
            },
        ),
        setSize: vi.fn(),
        setPixelRatio: vi.fn(),
        setViewport: vi.fn(),
    };
    return { renderer, targets };
};

// Listens for the dispose event of every target the renderer is given.
const watchDispose = (renderer: ReturnType<typeof fakeRenderer>['renderer']) => {
    const disposed = vi.fn();
    const setRenderTarget = renderer.setRenderTarget.getMockImplementation()!;
    renderer.setRenderTarget.mockImplementation((target: WebGLRenderTarget | null) => {
        target?.addEventListener('dispose', disposed);
        setRenderTarget(target);
    });
    return disposed;
};

const scene = new Scene();
const camera = new PerspectiveCamera();

describe('flipRows', () => {
    it('reverses the rows, so GL bottom-up becomes top-down', () => {
        const pixels = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
        expect(Array.from(flipRows(pixels, 1, 3))).toEqual([3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1]);
    });
});

describe('renderToImageData', () => {
    it('renders into a 4x multisampled sRGB target of the asked size', () => {
        const { renderer, targets } = fakeRenderer();
        const image = renderToImageData(renderer as never, scene, camera, 4, 2);
        expect(image.width).toBe(4);
        expect(image.height).toBe(2);
        expect(targets[0].samples).toBe(4);
        expect(targets[0].texture.colorSpace).toBe(SRGBColorSpace);
        expect(renderer.readRenderTargetPixels).toHaveBeenCalledWith(targets[0], 0, 0, 4, 2, expect.any(Uint8Array));
    });

    it('restores the previous target and disposes its own, even when the render throws', () => {
        const { renderer } = fakeRenderer({ renderThrows: true });
        const disposed = watchDispose(renderer);
        expect(() => renderToImageData(renderer as never, scene, camera, 2, 2)).toThrow('render failed');
        expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
        expect(disposed).toHaveBeenCalledOnce();
    });

    it('disposes the target after a successful read', () => {
        const { renderer } = fakeRenderer();
        const disposed = watchDispose(renderer);
        renderToImageData(renderer as never, scene, camera, 2, 2);
        expect(disposed).toHaveBeenCalledOnce();
    });

    it('never changes the renderer size, ratio or viewport', () => {
        const { renderer } = fakeRenderer();
        renderToImageData(renderer as never, scene, camera, 2, 2);
        expect(renderer.setSize).not.toHaveBeenCalled();
        expect(renderer.setPixelRatio).not.toHaveBeenCalled();
        expect(renderer.setViewport).not.toHaveBeenCalled();
    });

    it('throws on a lost context without rendering', () => {
        const { renderer } = fakeRenderer({ lostBefore: true });
        expect(() => renderToImageData(renderer as never, scene, camera, 2, 2)).toThrow();
        expect(renderer.render).not.toHaveBeenCalled();
    });

    it('throws when the read leaves the buffer empty, and still restores and disposes', () => {
        const { renderer } = fakeRenderer({ opaque: false });
        const disposed = watchDispose(renderer);
        expect(() => renderToImageData(renderer as never, scene, camera, 3, 3)).toThrow(
            'Offscreen read returned no pixels',
        );
        expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
        expect(disposed).toHaveBeenCalledOnce();
    });

    it('throws when the context is lost during the render', () => {
        const { renderer } = fakeRenderer({ lostAfterRender: true });
        expect(() => renderToImageData(renderer as never, scene, camera, 2, 2)).toThrow(
            'Offscreen read returned no pixels',
        );
    });
});

describe('solidColourProbe', () => {
    it('is a plane of exactly that colour', () => {
        const { scene: probe } = solidColourProbe('#808080');
        const plane = probe.children[0] as Mesh;
        expect((plane.material as MeshBasicMaterial).color).toEqual(new Color('#808080'));
    });
});
