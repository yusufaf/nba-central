import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPhotoInput } from '@/components/scene3d/teamPhotoInput';

const mocks = vi.hoisted(() => ({
    frame: vi.fn(),
    sample: vi.fn(),
    sampled: { primary: '#2f5d9b', secondary: '#f4f4f2', trim: '#ffffff' },
}));

vi.mock('@/three/scene/teamPhoto', () => ({ renderTeamPhotoFrame: mocks.frame }));
vi.mock('@/three/arena/rasteriseCourt', () => ({ rasteriseCourt: async () => null }));
vi.mock('@/utils/jerseyColours', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils/jerseyColours')>()),
    loadJerseyColours: mocks.sample,
}));

import { renderTeamPhoto } from '@/components/scene3d/teamPhoto';

const input = (overrides: Partial<TeamPhotoInput> = {}): TeamPhotoInput => ({
    court: null,
    capacity: 18000,
    people: [{ id: 'player-1', name: 'A', role: 'player', heightInches: 75, weightPounds: 190, number: '23' }],
    jerseyUrl: 'https://cdn/jersey.png',
    teamName: 'Owls',
    ...overrides,
});

describe('renderTeamPhoto', () => {
    beforeEach(() => {
        mocks.frame.mockReset().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,x' });
        mocks.sample.mockReset().mockResolvedValue(mocks.sampled);
    });

    it('draws with the uniform override and never samples', async () => {
        const uniform = { primary: '#aa0000', secondary: '#ffffff', trim: '#000000' };
        await renderTeamPhoto(input({ uniform }));
        expect(mocks.sample).not.toHaveBeenCalled();
        expect(mocks.frame).toHaveBeenCalledWith(
            expect.objectContaining({ kit: { colours: uniform, teamName: 'Owls' } }),
        );
    });

    it("samples the jersey when there's no override, and passes each person's number", async () => {
        await renderTeamPhoto(input());
        expect(mocks.sample).toHaveBeenCalledWith('https://cdn/jersey.png');
        const [options] = mocks.frame.mock.calls[0];
        expect(options.kit).toEqual({ colours: mocks.sampled, teamName: 'Owls' });
        expect(options.people[0].number).toBe('23');
    });
});
