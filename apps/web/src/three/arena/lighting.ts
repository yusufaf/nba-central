import { DirectionalLight, Group, HemisphereLight } from 'three';

// Bright, even arena light: a sky/floor fill and one key from above the
// camera side. No shadow maps (too costly on phones).
export const broadcastLighting = (): Group => {
    const group = new Group();
    group.add(new HemisphereLight('#ffffff', '#30261c', 1.6));
    const key = new DirectionalLight('#ffffff', 2.2);
    key.position.set(4, 20, 12);
    group.add(key);
    return group;
};
