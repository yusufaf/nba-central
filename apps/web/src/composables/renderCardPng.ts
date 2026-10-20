import { createApp, nextTick, type Component } from 'vue';
import { toPng } from 'html-to-image';

// Its own module, apart from useShareCard: that one imports the team card,
// which a page rendering another card shouldn't have to load.

// A stalled image (dropped connection, ad-blocked host) must not wedge
// publishing forever - proceed with whatever has loaded once this elapses.
const IMAGE_WAIT_MS = 4000;

const waitForImages = async (root: HTMLElement) => {
    const images = Array.from(root.querySelectorAll('img'));
    const allImagesSettled = Promise.all(
        images.map(
            (img) =>
                new Promise<void>((resolve) => {
                    if (img.complete) return resolve();
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                }),
        ),
    );
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_MS));
    await Promise.race([allImagesSettled, timeout]);
    // Let the component react to any @error swaps before exporting.
    await nextTick();
};

/**
 * Renders a 1200x630 card component off-screen and returns it as a PNG data
 * URL. Mounts a throwaway Vue app, so the card must be pure props, and the
 * props must be plain values: createApp doesn't unwrap refs passed to it.
 */
export const renderCardPng = async (component: Component, props: Record<string, unknown>): Promise<string> => {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-200rem';
    host.style.top = '0';
    document.body.appendChild(host);

    const app = createApp(component, props);
    try {
        const vm = app.mount(host);
        const el = vm.$el as HTMLElement;
        await waitForImages(el);
        return await toPng(el, {
            width: 1200,
            height: 630,
            pixelRatio: 1,
            cacheBust: true,
            // By default one image that fails to load rejects the whole
            // export. The court's centre logo is an SVG <image> with no
            // @error fallback of its own, so a dead URL drops that image
            // and the card still renders.
            onImageErrorHandler: () => undefined,
        });
    } finally {
        app.unmount();
        host.remove();
    }
};
