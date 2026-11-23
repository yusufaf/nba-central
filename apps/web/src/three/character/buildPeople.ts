import type { Group } from 'three';
import type { KitColours } from '@/utils/jerseyColours';
import { disposeObject } from '@/three/renderer/shared';
import { buildPerson, type PersonInput } from './person';

// Everyone or no one: if any build fails, the ones that finished are freed
// before the first failure is rethrown.
export const buildPeople = async (
    people: PersonInput[],
    kit: { colours: KitColours; teamName: string },
): Promise<{ root: Group; headHeight: number }[]> => {
    const settled = await Promise.allSettled(people.map((person) => buildPerson(person, kit)));
    const failed = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    const built = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (failed) {
        for (const { root } of built) disposeObject(root);
        throw failed.reason;
    }
    return built;
};
