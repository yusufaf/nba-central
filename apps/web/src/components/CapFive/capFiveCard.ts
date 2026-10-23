import CapFiveShareCard from '@/components/CapFive/CapFiveShareCard.vue';
import { renderCardPng } from '@/composables/renderCardPng';
import { dataUrlToBlob } from '@/composables/useDrawing';
import type { CapFiveResult } from '@/models/api';

/** The 1200x630 result card as a PNG. */
export const renderCapFiveCard = async (result: CapFiveResult, streak: number | null): Promise<Blob> =>
    dataUrlToBlob(await renderCardPng(CapFiveShareCard, { result, streak }));
