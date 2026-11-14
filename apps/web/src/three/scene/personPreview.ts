import { PerspectiveCamera, type Group } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCourt } from '@/three/arena/court';
import { blobShadow } from '@/three/arena/shadow';
import { buildPerson, type PersonInput } from '@/three/character/person';
import { disposeObject, getSharedRenderer } from '@/three/renderer/shared';
import type { KitColours } from '@/utils/jerseyColours';
import { PREVIEW_ORBIT, framePerson } from './cameraPresets';
import { createStage } from './stage';

type Kit = { colours: KitColours; teamName: string };

// The player creator's preview: one person on a neutral court, lit like the
// arena. Every edit rebuilds the person; frames render only on a change.
export class PersonPreview {
    renderCount = 0;
    onRender: (() => void) | null = null;
    onError: (() => void) | null = null;
    /** A build landed: the preview matches the latest edit it has shown. */
    onShown: (() => void) | null = null;

    private readonly renderer = getSharedRenderer();
    private readonly scene = createStage();
    private readonly camera = new PerspectiveCamera(30, 1, 0.1, 100);
    private readonly controls: OrbitControls;
    private readonly observer: ResizeObserver;
    private person: Group | null = null;
    private height = 0;
    private building = false;
    private pending: { input: PersonInput; kit: Kit } | null = null;
    private frameRequested = false;
    private disposed = false;

    constructor(private readonly container: HTMLElement) {
        const canvas = this.renderer.domElement;
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        container.appendChild(canvas);

        this.scene.add(buildCourt(null));
        const shadow = blobShadow(0.45);
        shadow.position.y = 0.005;
        this.scene.add(shadow);

        this.controls = new OrbitControls(this.camera, canvas);
        Object.assign(this.controls, PREVIEW_ORBIT);
        this.controls.addEventListener('change', () => this.requestRender());
        // As in TeamScene: vertical swipes and the wheel scroll the page.
        canvas.style.touchAction = 'pan-y';
        canvas.addEventListener('wheel', this.onWheel, { capture: true });

        if (import.meta.env.DEV) {
            (window as unknown as { __scene3dInfo?: () => object }).__scene3dInfo = () => ({
                ...this.renderer.info.memory,
                canvases: document.querySelectorAll('canvas').length,
            });
        }

        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(container);
        this.resize();
    }

    // One build at a time, plus the latest edit queued behind it: a slider
    // drag skips the values in between instead of building each one.
    setPerson(input: PersonInput, kit: Kit): void {
        if (this.disposed) return;
        if (this.building) {
            this.pending = { input, kit };
            return;
        }
        this.building = true;
        void this.build(input, kit);
    }

    rotate(step: number): void {
        if (this.disposed) return;
        this.controls.rotateLeft(step);
        this.requestRender();
    }

    resetView(): void {
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
        this.pending = null;
        this.observer.disconnect();
        this.controls.dispose();
        this.renderer.domElement.removeEventListener('wheel', this.onWheel, { capture: true });
        disposeObject(this.scene);
        this.person = null;
        const canvas = this.renderer.domElement;
        if (canvas.parentElement === this.container) canvas.remove();
    }

    private async build(input: PersonInput, kit: Kit): Promise<void> {
        try {
            const { root, headHeight } = await buildPerson(input, kit);
            // Shown even when a newer edit is queued, so a slider drag
            // updates as fast as builds finish.
            if (this.disposed) disposeObject(root);
            else this.show(root, headHeight);
        } catch (error) {
            console.error('Could not build the preview person', error);
            if (!this.disposed) this.onError?.();
        }
        this.building = false;
        const next = this.pending;
        this.pending = null;
        if (next && !this.disposed) this.setPerson(next.input, next.kit);
    }

    private show(root: Group, height: number): void {
        if (this.person) {
            this.scene.remove(this.person);
            disposeObject(this.person);
        }
        this.person = root;
        this.scene.add(root);
        this.onShown?.();
        // A new height re-frames; any other edit keeps the user's orbit.
        if (height !== this.height) {
            this.height = height;
            this.frame();
        } else {
            this.requestRender();
        }
    }

    private readonly onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
    };

    private resize(): void {
        const { clientWidth: width, clientHeight: height } = this.container;
        if (!width || !height) return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.requestRender();
    }

    private frame(): void {
        if (!this.height) return;
        const { position, target, fov } = framePerson(this.height, this.camera.aspect);
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(...position);
        this.controls.target.set(...target);
        this.controls.update();
        this.requestRender();
    }
}
