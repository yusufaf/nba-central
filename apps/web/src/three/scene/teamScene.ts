import { Color, Fog, Group, PerspectiveCamera, Scene } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildBowl, bowlLayout } from '@/three/arena/bowl';
import { buildCourt, courtTexture } from '@/three/arena/court';
import { broadcastLighting } from '@/three/arena/lighting';
import { FOG, SCENE_COLOURS } from '@/three/arena/palette';
import { disposeObject, getSharedRenderer } from '@/three/renderer/shared';
import { ORBIT_LIMITS, framePreset, type CameraPreset } from './cameraPresets';

// The team's arena in 3D. Frames render only when something changes (a
// camera move, a resize, a new arena), never in a loop.
export class TeamScene {
    renderCount = 0;
    onRender: (() => void) | null = null;

    private readonly renderer = getSharedRenderer();
    private readonly scene = new Scene();
    private readonly camera = new PerspectiveCamera(40, 1, 0.1, 200);
    private readonly controls: OrbitControls;
    private readonly observer: ResizeObserver;
    private arena: Group | null = null;
    private preset: CameraPreset = 'team';
    private frameRequested = false;
    private disposed = false;

    constructor(private readonly container: HTMLElement) {
        const canvas = this.renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        this.scene.background = new Color(SCENE_COLOURS.background);
        this.scene.fog = new Fog(SCENE_COLOURS.background, FOG.near, FOG.far);
        this.scene.add(broadcastLighting());

        this.controls = new OrbitControls(this.camera, canvas);
        Object.assign(this.controls, ORBIT_LIMITS);
        this.controls.addEventListener('change', () => this.requestRender());

        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(container);
        this.resize();
    }

    setArena(court: HTMLCanvasElement | null, capacity: number | null): void {
        if (this.disposed) return;
        if (this.arena) {
            this.scene.remove(this.arena);
            disposeObject(this.arena);
        }
        const arena = new Group();
        arena.add(buildCourt(court ? courtTexture(court, this.renderer) : null));
        arena.add(buildBowl(bowlLayout(capacity), SCENE_COLOURS.seat));
        this.arena = arena;
        this.scene.add(arena);
        this.requestRender();
    }

    setPreset(preset: CameraPreset): void {
        this.preset = preset;
        this.frame();
    }

    requestRender(): void {
        if (this.disposed || this.frameRequested) return;
        this.frameRequested = true;
        requestAnimationFrame(() => {
            this.frameRequested = false;
            if (this.disposed) return;
            this.renderer.render(this.scene, this.camera);
            this.renderCount++;
            this.onRender?.();
        });
    }

    dispose(): void {
        this.disposed = true;
        this.observer.disconnect();
        this.controls.dispose();
        disposeObject(this.scene);
        this.arena = null;
        this.renderer.domElement.remove();
    }

    private resize(): void {
        const { clientWidth: width, clientHeight: height } = this.container;
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.frame();
    }

    private frame(): void {
        const { position, target, fov } = framePreset(this.preset, this.camera.aspect);
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(...position);
        this.controls.target.set(...target);
        this.controls.update();
        this.requestRender();
    }
}
