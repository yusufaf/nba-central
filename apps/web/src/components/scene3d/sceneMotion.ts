import { computed, type ComputedRef } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useReducedMotion } from '@/composables/useDisplayPreferences';

// Touch screens: phones and tablets. The 3D spec keeps scene motion off there,
// whatever the Reduced motion setting says.
export const COARSE_POINTER = '(pointer: coarse)';

/**
 * Whether the 3D scene may animate (the ribbon's scroll). Either reduced
 * motion or a touch screen turns it off; neither turns it on. Not in
 * useDisplayPreferences: the touch-screen rule is the 3D scene's alone.
 */
export const useSceneMotion = (): ComputedRef<boolean> => {
    const reduceMotion = useReducedMotion();
    const coarsePointer = useMediaQuery(COARSE_POINTER);
    return computed(() => !reduceMotion.value && !coarsePointer.value);
};
