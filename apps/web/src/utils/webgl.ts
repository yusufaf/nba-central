// Feature check for the 3D view. Deliberately free of three.js so the public
// team page can ask without loading the 3D chunk.
export const isWebGLAvailable = (): boolean => {
    try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
        return false;
    }
};
