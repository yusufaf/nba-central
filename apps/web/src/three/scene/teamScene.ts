import { Group, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildPerson, type PersonInput } from '@/three/character/person';
import type { KitColours } from '@/utils/jerseyColours';
import { disposeObject, getSharedRenderer } from '@/three/renderer/shared';
import { buildArena, createStage, placeInRows } from './stage';
import { ORBIT_LIMITS, TWO_ROWS_BELOW_ASPECT, framePreset, type CameraPreset } from './cameraPresets';

export interface LabelAnchor {
    id: string;
    x: number; // container pixels
    y: number;
    visible: boolean;
}

// How far above the head a name chip sits, in metres.
const CHIP_LIFT = 0.25;

// The team's arena in 3D. Frames render only when something changes (a
// camera move, a resize, a new arena), never in a loop.
export class TeamScene {
    renderCount = 0;
    onRender: (() => void) | null = null;

    private readonly renderer = getSharedRenderer();
    private readonly scene = createStage();
    private readonly camera = new PerspectiveCamera(40, 1, 0.1, 200);
    private readonly controls: OrbitControls;
    private readonly observer: ResizeObserver;
    private arena: Group | null = null;
    private preset: CameraPreset = 'team';
    private frameRequested = false;
    private disposed = false;
    private peopleGroup = new Group();
    private people: { id: string; root: Group; head: number }[] = [];
    private peopleRequest = 0;
    private twoRows = false;
    private anchors: LabelAnchor[] = [];

    constructor(private readonly container: HTMLElement) {
        const canvas = this.renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        this.scene.add(this.peopleGroup);

        this.controls = new OrbitControls(this.camera, canvas);
        Object.assign(this.controls, ORBIT_LIMITS);
        this.controls.addEventListener('change', () => this.requestRender());
        // The scene fills most of a phone screen, so it must not trap the page:
        // vertical swipes scroll (OrbitControls sets touch-action: none), and the
        // wheel scrolls unless Ctrl or Cmd is held, which zooms. The capture
        // listener runs before OrbitControls' own wheel handler on this element.
        canvas.style.touchAction = 'pan-y';
        canvas.addEventListener('wheel', this.onWheel, { capture: true });

        // Dev-only probe for the Playwright memory check (tests/visual).
        if (import.meta.env.DEV) {
            (window as unknown as { __scene3dInfo?: () => object }).__scene3dInfo = () => ({
                ...this.renderer.info.memory,
                canvases: document.querySelectorAll('canvas').length,
            });
        }

        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(container);
        this.resize();
        this.frame();
    }

    setArena(court: HTMLCanvasElement | null, capacity: number | null): void {
        if (this.disposed) return;
        if (this.arena) {
            this.scene.remove(this.arena);
            disposeObject(this.arena);
        }
        const arena = buildArena(court, capacity, this.renderer);
        this.arena = arena;
        this.scene.add(arena);
        this.requestRender();
    }

    // Builds everyone, then swaps them in at once. A newer call wins: an
    // older one that finishes later is disposed, never shown.
    async setPeople(people: PersonInput[], kit: { colours: KitColours; teamName: string }): Promise<void> {
        const request = ++this.peopleRequest;
        const built = await Promise.all(people.map((person) => buildPerson(person, kit)));
        if (request !== this.peopleRequest || this.disposed) {
            for (const { root } of built) disposeObject(root);
            return;
        }
        this.scene.remove(this.peopleGroup);
        disposeObject(this.peopleGroup);
        this.peopleGroup = new Group();
        this.people = built.map(({ root, headHeight }, i) => ({ id: people[i].id, root, head: headHeight }));
        this.placePeople();
        this.scene.add(this.peopleGroup);
        this.requestRender();
    }

    // Where each person's name chip goes, as of the last frame.
    labelAnchors(): LabelAnchor[] {
        if (this.anchors.length !== this.people.length) this.updateAnchors();
        return this.anchors;
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
            this.updateAnchors();
            this.renderCount++;
            this.onRender?.();
        });
    }

    dispose(): void {
        this.disposed = true;
        this.observer.disconnect();
        this.controls.dispose();
        this.renderer.domElement.removeEventListener('wheel', this.onWheel, { capture: true });
        disposeObject(this.scene);
        this.arena = null;
        // The canvas is shared: if another scene has already taken it, leave it.
        const canvas = this.renderer.domElement;
        if (canvas.parentElement === this.container) canvas.remove();
    }

    private readonly onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
    };

    private resize(): void {
        const { clientWidth: width, clientHeight: height } = this.container;
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        // A change of rows moves everyone, so the shot is framed afresh.
        if (this.camera.aspect < TWO_ROWS_BELOW_ASPECT !== this.twoRows) {
            this.placePeople();
            this.frame();
            return;
        }
        // Otherwise keep wherever the user has orbited to: a phone's URL bar
        // collapsing on scroll resizes the view. Only the lens follows the new shape.
        this.camera.fov = framePreset(this.preset, this.camera.aspect).fov;
        this.camera.updateProjectionMatrix();
        this.requestRender();
    }

    private placePeople(): void {
        this.twoRows = this.camera.aspect < TWO_ROWS_BELOW_ASPECT;
        placeInRows(
            this.peopleGroup,
            this.people.map(({ root }) => root),
            this.twoRows,
        );
        this.requestRender();
    }

    private updateAnchors(): void {
        const { clientWidth: width, clientHeight: height } = this.container;
        this.camera.updateMatrixWorld();
        const point = new Vector3();
        this.anchors = this.people.map(({ id, root, head }) => {
            root.getWorldPosition(point);
            point.y += head + CHIP_LIFT;
            point.project(this.camera);
            return {
                id,
                x: ((point.x + 1) / 2) * width,
                y: ((1 - point.y) / 2) * height,
                visible: point.z < 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1,
            };
        });
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
