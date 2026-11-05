// Throwaway spike (#119). The team scene: arena + seven people, camera
// presets, on-demand rendering, and the measurements the Phase 0 gate needs.
import { Color, Fog, Group, PerspectiveCamera, Scene, Vector3, type Texture } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildArena, blobShadow, type BuiltArena, type Venue } from './arena';
import { buildCharacter, type CharacterSpec } from './character';
import { MAX_PIXEL_RATIO, disposeTree, getRenderer } from './renderer';

export type CameraPreset = 'team' | 'courtside' | 'broadcast' | 'rafters' | 'creator';

const PRESETS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
    team: { position: [0, 1.5, 9.5], target: [0, 1.1, 0] },
    courtside: { position: [7.5, 1.2, 6], target: [0, 1.2, 0] },
    broadcast: { position: [0, 10, 24], target: [0, 1, 0] },
    rafters: { position: [0.01, 30, 6], target: [0, 0, 0] },
    creator: { position: [0, 1.25, 3.6], target: [0, 1.05, 0] },
};

export interface FrameStats {
    calls: number;
    triangles: number;
    textures: number;
    geometries: number;
}

export interface OrbitResult {
    frames: number;
    p50: number;
    p95: number;
    max: number;
    pixelRatio: number;
}

const percentile = (values: number[], p: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

export class SpikeScene {
    readonly scene = new Scene();
    readonly camera = new PerspectiveCamera(40, 1, 0.1, 200);
    private controls: OrbitControls;
    private renderer = getRenderer();
    private arena: BuiltArena | null = null;
    private people = new Group();
    private frameRequested = false;
    private container: HTMLElement;
    private resizeObserver: ResizeObserver;
    firstFrameAt: number | null = null;
    onRender: ((stats: FrameStats) => void) | null = null;

    constructor(container: HTMLElement) {
        this.container = container;
        container.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.scene.background = new Color('#0b0d11');
        this.scene.fog = new Fog('#0b0d11', 40, 90);
        this.scene.add(this.people);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = false;
        this.controls.maxPolarAngle = Math.PI * 0.49;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 45;
        this.controls.addEventListener('change', () => this.requestRender());
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);
        this.resize();
        this.setPreset('team');
    }

    resize() {
        const { clientWidth: width, clientHeight: height } = this.container;
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.requestRender();
    }

    setPreset(preset: CameraPreset) {
        const { position, target } = PRESETS[preset];
        this.camera.position.set(...position);
        this.controls.target.set(...target);
        this.controls.update();
        this.requestRender();
    }

    setArena(venue: Venue, courtTexture: Texture | null) {
        if (this.arena) {
            this.scene.remove(this.arena.group);
            disposeTree(this.arena.group);
        }
        this.arena = buildArena(venue, courtTexture, this.renderer);
        this.scene.add(this.arena.group);
        this.requestRender();
    }

    async setPeople(specs: CharacterSpec[], spacing = 1.35): Promise<number> {
        const built = await Promise.all(specs.map(buildCharacter));
        this.scene.remove(this.people);
        disposeTree(this.people);
        this.people = new Group();
        let triangles = 0;
        built.forEach((character, i) => {
            const x = (i - (built.length - 1) / 2) * spacing;
            character.root.position.set(x, 0, i % 2 === 0 ? 0 : -0.35);
            this.people.add(character.root);
            const shadow = blobShadow(0.45);
            shadow.position.x = x;
            shadow.position.z = character.root.position.z;
            this.people.add(shadow);
            triangles += character.triangles;
        });
        this.scene.add(this.people);
        this.requestRender();
        return triangles;
    }

    requestRender() {
        if (this.frameRequested) return;
        this.frameRequested = true;
        requestAnimationFrame(() => {
            this.frameRequested = false;
            this.render();
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
        if (this.firstFrameAt === null && this.people.children.length > 0) this.firstFrameAt = performance.now();
        const info = this.renderer.info;
        this.onRender?.({
            calls: info.render.calls,
            triangles: info.render.triangles,
            textures: info.memory.textures,
            geometries: info.memory.geometries,
        });
    }

    // A scripted 10-second orbit, rendering every frame, at the capped
    // pixel ratio. Returns frame-time percentiles in milliseconds.
    orbitTest(seconds = 10): Promise<OrbitResult> {
        return new Promise((resolve) => {
            const target = this.controls.target.clone();
            const offset = this.camera.position.clone().sub(target);
            const radius = Math.hypot(offset.x, offset.z);
            const height = offset.y;
            const start = performance.now();
            const deltas: number[] = [];
            let last = start;
            const step = (now: number) => {
                const t = (now - start) / 1000;
                deltas.push(now - last);
                last = now;
                const angle = (t / seconds) * Math.PI * 2;
                this.camera.position.copy(target).add(new Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius));
                this.camera.lookAt(target);
                this.arena?.tick(1 / 60);
                this.render();
                if (t < seconds) requestAnimationFrame(step);
                else {
                    const frames = deltas.slice(2);
                    resolve({
                        frames: frames.length,
                        p50: percentile(frames, 50),
                        p95: percentile(frames, 95),
                        max: Math.max(...frames),
                        pixelRatio: this.renderer.getPixelRatio(),
                    });
                }
            };
            requestAnimationFrame(step);
        });
    }

    // Renders the current view at 1200x630 and encodes it both ways, to see
    // which fits under publishTeam's 2 MB limit.
    async cardFrame(): Promise<{ png: Blob; jpeg: Blob }> {
        const canvas = this.renderer.domElement;
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(1200, 630, false);
        this.camera.aspect = 1200 / 630;
        this.camera.updateProjectionMatrix();
        const encode = (type: string, quality?: number) =>
            new Promise<Blob>((resolve) => {
                this.renderer.render(this.scene, this.camera);
                canvas.toBlob((blob) => resolve(blob!), type, quality);
            });
        const png = await encode('image/png');
        const jpeg = await encode('image/jpeg', 0.88);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
        this.resize();
        return { png, jpeg };
    }

    dispose() {
        this.resizeObserver.disconnect();
        this.controls.dispose();
        disposeTree(this.scene);
        this.renderer.domElement.remove();
    }
}
