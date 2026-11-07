import { Material, Mesh, SkinnedMesh, Texture, WebGLRenderer, type BufferGeometry, type Object3D, type Skeleton } from 'three';

// Survives minification, so scripts/check-bundle.mjs can find the 3D chunk.
export const SCENE_CHUNK_MARKER = 'nba-central-3d-chunk';

export const MAX_PIXEL_RATIO = 1.5;

type ContextListener = (lost: boolean) => void;

let renderer: WebGLRenderer | null = null;
const listeners = new Set<ContextListener>();

// One renderer for every 3D surface: browsers (iOS especially) cap how many
// WebGL contexts can be live, and each new one costs a shader recompile.
export const getSharedRenderer = (): WebGLRenderer => {
    if (renderer) return renderer;
    const created = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    created.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    const canvas = created.domElement;
    canvas.dataset.chunk = SCENE_CHUNK_MARKER;
    canvas.addEventListener('webglcontextlost', (event) => {
        // Without this the browser never offers the context back.
        event.preventDefault();
        for (const listener of listeners) listener(true);
    });
    canvas.addEventListener('webglcontextrestored', () => {
        for (const listener of listeners) listener(false);
    });
    renderer = created;
    return created;
};

export const onContextChange = (listener: ContextListener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

// renderer.dispose() frees the renderer's own state, not what a scene holds.
// Geometries and materials can be shared between meshes, so each is freed once.
export const disposeObject = (root: Object3D): void => {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    // A skeleton holds its bone matrices in a GPU texture of its own.
    const skeletons = new Set<Skeleton>();
    root.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        if (node instanceof SkinnedMesh) skeletons.add(node.skeleton);
        geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material);
    });
    const textures = new Set<Texture>();
    for (const material of materials) {
        for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
        // Textures a patched shader reads through its own uniforms are listed
        // in userData.textures, since they aren't material properties.
        for (const value of material.userData.textures ?? []) if (value instanceof Texture) textures.add(value);
    }
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
};
