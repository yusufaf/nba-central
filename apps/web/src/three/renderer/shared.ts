import { Material, Mesh, SkinnedMesh, Texture, WebGLRenderer, type BufferGeometry, type Object3D, type Skeleton } from 'three';

// Survives minification, so scripts/check-bundle.mjs can find the 3D chunk.
export const SCENE_CHUNK_MARKER = 'nba-central-3d-chunk';

export const MAX_PIXEL_RATIO = 1.5;

type ContextListener = (lost: boolean) => void;

let renderer: WebGLRenderer | null = null;
const listeners = new Set<ContextListener>();
// On-screen scenes holding the renderer (the share card renders off-screen and doesn't count).
let open = 0;

export const pixelRatio = (): number => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

// One renderer for every 3D surface: browsers (iOS especially) cap how many
// WebGL contexts can be live, and each new one costs a shader recompile.
export const getSharedRenderer = (): WebGLRenderer => {
    if (renderer) return renderer;
    const created = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    created.setPixelRatio(pixelRatio());
    // No drawing buffer until a scene sizes it: the share card only renders to a target.
    created.setSize(1, 1, false);
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

// A context lost while no scene was open fires no event a later scene could hear.
export const isContextLost = (): boolean => renderer?.getContext().isContextLost() ?? false;

// On-screen scenes take the renderer here and give it back when they close.
export const acquireRenderer = (): WebGLRenderer => {
    const shared = getSharedRenderer();
    open += 1;
    return shared;
};

// The last scene to close drops the drawing buffer, which can be several megabytes.
export const releaseRenderer = (): void => {
    open = Math.max(0, open - 1);
    if (open === 0) renderer?.setSize(1, 1, false);
};

// Sizes the canvas, following browser zoom and moves between monitors. A new
// ratio reallocates the buffer, so it is only set when it changed.
export const fitRenderer = (target: WebGLRenderer, width: number, height: number): void => {
    const ratio = pixelRatio();
    if (target.getPixelRatio() !== ratio) target.setPixelRatio(ratio);
    target.setSize(width, height, false);
};

// A resolution query only matches the ratio it was made for, so it is re-armed on each change.
export const onPixelRatioChange = (listener: () => void): (() => void) => {
    let query: MediaQueryList | null = null;
    const changed = () => {
        arm();
        listener();
    };
    const arm = () => {
        query?.removeEventListener('change', changed);
        query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        query.addEventListener('change', changed);
    };
    arm();
    return () => {
        query?.removeEventListener('change', changed);
        query = null;
    };
};

// renderer.dispose() frees the renderer's own state, not what a scene holds.
// Geometries and materials can be shared between meshes, so each is freed once.
// Textures flagged userData.shared belong to a cached file and are kept.
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
    // A loaded file's textures are shared by every clone (load.ts).
    for (const texture of textures) if (texture.userData.shared !== true) texture.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
};
