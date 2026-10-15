import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import NotFound from '@/views/NotFound.vue';

const mountNotFound = async () => {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/:pathMatch(.*)*', component: NotFound },
        ],
    });
    await router.push('/nope');
    await router.isReady();
    return mount(NotFound, { global: { plugins: [router] } });
};

describe('NotFound', () => {
    it('says the page does not exist', async () => {
        const wrapper = await mountNotFound();
        expect(wrapper.get('h1').text()).toBe("This page doesn't exist");
    });

    it('links back to the home page', async () => {
        const wrapper = await mountNotFound();
        expect(wrapper.get('a[href="/"]').text()).toBe('Go to the home page');
    });
});
