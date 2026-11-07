import { createApp, h, nextTick } from 'vue';
import CourtFloor from '@/components/court/CourtFloor.vue';
import { rasteriseCourt } from '@/three/arena/rasteriseCourt';
import { loadJerseyColours } from '@/three/character/jerseyColours';
import { renderTeamPhotoFrame } from '@/three/scene/teamPhoto';
import { DEFAULT_COURT, courtAttempts } from './courtRaster';
import type { TeamPhotoInput } from './teamPhotoInput';

// Draws the court off screen, as the live 3D view does, trying with fewer
// images each time one blocks the read. Null: the plain default floor.
const courtCanvas = async (input: TeamPhotoInput): Promise<HTMLCanvasElement | null> => {
    for (const attempt of courtAttempts(input.logoUrl, input.drawingUrl)) {
        const host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        Object.assign(host.style, { position: 'fixed', left: '-200rem', top: '0', width: '65rem', pointerEvents: 'none' });
        document.body.appendChild(host);
        const app = createApp({
            render: () =>
                h(CourtFloor, {
                    court: input.court ?? DEFAULT_COURT,
                    logoUrl: attempt.logo,
                    drawingUrl: attempt.drawing,
                    decorative: true,
                }),
        });
        try {
            app.mount(host);
            await nextTick();
            const node = host.firstElementChild as HTMLElement | null;
            const canvas = node ? await rasteriseCourt(node) : null;
            if (canvas) return canvas;
        } finally {
            app.unmount();
            host.remove();
        }
    }
    return null;
};

// The share card's 3D team photo, as a PNG data URL.
export const renderTeamPhoto = async (input: TeamPhotoInput): Promise<string> => {
    const [court, colours] = await Promise.all([courtCanvas(input), loadJerseyColours(input.jerseyUrl)]);
    const canvas = await renderTeamPhotoFrame({
        court,
        capacity: input.capacity,
        people: input.people,
        kit: { colours, teamName: input.teamName },
    });
    return canvas.toDataURL('image/png');
};
