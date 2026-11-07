// Feature check for the 3D view. Deliberately free of three.js so the public
// team page can ask without loading the 3D chunk. Asks for WebGL2 only:
// three.js r163+ has no WebGL1 renderer, so a WebGL1-only device can't run it.
// Call it only when someone opens 3D: each probe costs a GPU context, so the
// answer is cached and the probe's context released at once.
let cached: boolean | null = null;

export const isWebGLAvailable = (): boolean => {
    if (cached !== null) return cached;
    try {
        const gl = document.createElement('canvas').getContext('webgl2');
        cached = !!gl;
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
        cached = false;
    }
    return cached;
};
