import { Group, PerspectiveCamera, Vector3, type Object3D, type Texture } from 'three';
import type { VenueDesign } from '@/constants/venue';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ribbonTextureIn, scrollRibbon } from '@/three/arena/ribbon';
import { buildPeople } from '@/three/character/buildPeople';
import type { PersonInput } from '@/three/character/person';
import type { KitColours } from '@/utils/jerseyColours';
import {
    acquireRenderer,
    disposeObject,
    fitRenderer,
    getSharedRenderer,
    onPixelRatioChange,
    releaseRenderer,
} from '@/three/renderer/shared';
import { buildCourtFloor, buildSeating, createStage, placeInRows, setStageLighting } from './stage';
import { lightingDesign } from '@/utils/venue';
import { ORBIT_LIMITS, TWO_ROWS_BELOW_ASPECT, framePreset, type CameraPreset } from './cameraPresets';

export interface LabelAnchor {
    id: string;
    x: number; // container pixels
    y: number;
    depth: number; // normalised device z: larger is farther
    visible: boolean;
}

const sameAnchors = (a: LabelAnchor[], b: LabelAnchor[]) =>
    a.length === b.length &&
    a.every((anchor, i) => {
        const other = b[i];
        return (
            anchor.id === other.id &&
            anchor.x === other.x &&
            anchor.y === other.y &&
            anchor.depth === other.depth &&
            anchor.visible === other.visible
        );
    });

// How far above the head a name chip sits, in metres.
const CHIP_LIFT = 0.25;

// The ribbon scrolls at about 30 fps. The slack keeps 60, 120 and 144 Hz
// displays on a steady every-other (or every-fourth) frame instead of
// alternating 2- and 3-frame gaps when rAF's timestamps jitter around 33.3 ms.
const FRAME_MS = 1000 / 30;
const FRAME_SLACK_MS = 4;

// The team's arena in 3D. Frames render only when something changes (a
// camera move, a resize, a new arena). The one loop is the LED ribbon's
// scroll, which runs only while there is a ribbon and motion is allowed.
export class TeamScene {
    renderCount = 0;
    onRender: (() => void) | null = null;

    private readonly renderer = getSharedRenderer();
    private readonly scene = createStage();
    private readonly camera = new PerspectiveCamera(40, 1, 0.1, 200);
    private readonly controls: OrbitControls;
    private readonly observer: ResizeObserver;
    private readonly stopPixelRatio: () => void;
    private court: Object3D | null = null;
    private bowl: Object3D | null = null;
    private preset: CameraPreset = 'team';
    private frameRequested = false;
    private disposed = false;
    private peopleGroup = new Group();
    private people: { id: string; root: Group; head: number }[] = [];
    private peopleRequest = 0;
    private twoRows = false;
    private anchors: LabelAnchor[] = [];
    private motion = false;
    private ribbon: Texture | null = null;
    private loop = 0;
    private lastTick: number | null = null;

    constructor(private readonly container: HTMLElement) {
        acquireRenderer();
        // Nobody can dispose a scene whose constructor threw, so it undoes itself.
        try {
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
                    render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles },
                    canvases: document.querySelectorAll('canvas').length,
                });
            }

            this.observer = new ResizeObserver(() => this.resize());
            this.observer.observe(container);
            // Browser zoom and a move to another monitor change the ratio without a resize.
            this.stopPixelRatio = onPixelRatioChange(() => this.resize());
            this.resize();
            this.frame();
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    // The court and the bowl are swapped separately: a seat colour edit
    // shouldn't re-rasterise the court, and a court edit shouldn't rebuild seats.
    setCourt(court: HTMLCanvasElement | null): void {
        if (this.disposed) return;
        this.court = this.swap(this.court, buildCourtFloor(court, this.renderer));
    }

    setBowl(capacity: number | null, venue: VenueDesign | null): void {
        if (this.disposed) return;
        const previous = this.ribbon;
        this.bowl = this.swap(this.bowl, buildSeating(capacity, venue));
        // The swap above asks for a frame, which picks up the new lighting (#298).
        setStageLighting(this.scene, lightingDesign(venue));
        const next = ribbonTextureIn(this.bowl);
        // The editor rebuilds the bowl on every keystroke: the ribbon keeps its
        // place rather than snapping back to the start.
        if (previous && next) next.offset.x = previous.offset.x;
        this.ribbon = next;
        this.syncScroll();
    }

    /** Whether the scene may animate: the caller decides (reduced motion, touch screens). */
    setMotion(enabled: boolean): void {
        this.motion = enabled;
        this.syncScroll();
    }

    // At most one loop: a bowl rebuild while scrolling keeps the queued tick,
    // which picks up the new ribbon. Stopping leaves the text at rest.
    private syncScroll(): void {
        const run = this.motion && this.ribbon !== null && !this.disposed;
        if (run) {
            if (this.loop === 0) {
                this.lastTick = null;
                this.loop = requestAnimationFrame(this.tick);
            }
            return;
        }
        if (this.loop !== 0) cancelAnimationFrame(this.loop);
        this.loop = 0;
        this.lastTick = null;
        if (this.ribbon) {
            this.ribbon.offset.x = 0;
            this.requestRender();
        }
    }

    private readonly tick = (now: number): void => {
        this.loop = 0;
        if (!this.motion || !this.ribbon || this.disposed) return;
        // Seeded from rAF's own clock, never performance.now(), so the first
        // delta is a real frame's.
        if (this.lastTick === null) {
            this.lastTick = now;
        } else if (now - this.lastTick >= FRAME_MS - FRAME_SLACK_MS) {
            scrollRibbon(this.ribbon, (now - this.lastTick) / 1000);
            this.lastTick = now;
            // A pending on-demand frame draws the new offset itself, with anchors.
            if (!this.frameRequested) this.paint(false);
        }
        this.loop = requestAnimationFrame(this.tick);
    };

    private swap(old: Object3D | null, next: Object3D): Object3D {
        if (old) {
            this.scene.remove(old);
            disposeObject(old);
        }
        this.scene.add(next);
        this.requestRender();
        return next;
    }

    // Builds everyone, then swaps them in at once. A newer call wins: an
    // older one that finishes later is disposed, never shown, and one that
    // fails after being replaced stays quiet.
    async setPeople(people: PersonInput[], kit: { colours: KitColours; teamName: string }): Promise<void> {
        const request = ++this.peopleRequest;
        let built: Awaited<ReturnType<typeof buildPeople>>;
        try {
            built = await buildPeople(people, kit);
        } catch (error) {
            if (request !== this.peopleRequest || this.disposed) return;
            throw error;
        }
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
            this.paint(true);
        });
    }

    // A scroll frame skips the anchors, and a frame where nothing moved keeps
    // them: either way labelAnchors() returns the same array and the chips
    // don't re-render.
    private paint(withAnchors: boolean): void {
        this.renderer.render(this.scene, this.camera);
        if (withAnchors) this.updateAnchors();
        this.renderCount++;
        this.onRender?.();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        // These three are unset when the constructor threw before reaching them.
        this.stopPixelRatio?.();
        if (this.loop !== 0) cancelAnimationFrame(this.loop);
        this.loop = 0;
        this.observer?.disconnect();
        this.controls?.dispose();
        this.renderer.domElement.removeEventListener('wheel', this.onWheel, { capture: true });
        disposeObject(this.scene);
        this.court = null;
        this.bowl = null;
        // The canvas is shared: if another scene has already taken it, leave it.
        const canvas = this.renderer.domElement;
        if (canvas.parentElement === this.container) canvas.remove();
        releaseRenderer();
    }

    private readonly onWheel = (event: WheelEvent) => {
        if (!event.ctrlKey && !event.metaKey) event.stopImmediatePropagation();
    };

    private resize(): void {
        const { clientWidth: width, clientHeight: height } = this.container;
        if (!width || !height) return;
        fitRenderer(this.renderer, width, height);
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
        const next = this.people.map(({ id, root, head }) => {
            root.getWorldPosition(point);
            point.y += head + CHIP_LIFT;
            point.project(this.camera);
            return {
                id,
                x: ((point.x + 1) / 2) * width,
                y: ((1 - point.y) / 2) * height,
                depth: point.z,
                visible: point.z < 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1,
            };
        });
        if (!sameAnchors(this.anchors, next)) this.anchors = next;
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
