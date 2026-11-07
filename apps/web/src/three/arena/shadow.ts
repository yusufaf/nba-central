import { CanvasTexture, CircleGeometry, Mesh, MeshBasicMaterial } from 'three';

// A soft dark disc under each person: far cheaper than a shadow map.
export const blobShadow = (radius: number): Mesh => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
    }
    const mesh = new Mesh(
        new CircleGeometry(radius, 24),
        new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.005;
    mesh.name = 'shadow';
    return mesh;
};
