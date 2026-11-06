// Throwaway spike (#119). One WebGLRenderer for the whole app: iOS caps how
// many WebGL contexts can be live, so every 3D surface borrows this one.
import { Material, Mesh, Object3D, Texture, WebGLRenderer } from 'three';

let shared: WebGLRenderer | null = null;

export const MAX_PIXEL_RATIO = 1.5;

export const getRenderer = (): WebGLRenderer => {
    if (shared) return shared;
    const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.domElement.addEventListener('webglcontextlost', (event) => event.preventDefault());
    shared = renderer;
    return renderer;
};

// renderer.dispose() frees the renderer's own state, not what the scene holds.
export const disposeTree = (root: Object3D) => {
    root.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
            for (const value of Object.values(material)) {
                if (value instanceof Texture) value.dispose();
            }
            material.dispose();
        }
    });
};
