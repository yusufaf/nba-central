import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import PublishDialog from '@/components/TeamBuilder/share/PublishDialog.vue';
import type { CardStyle } from '@/models/api';

// DialogContent teleports to document.body, so queries go to the document.
const mountDialog = (props: { cardStyle: CardStyle; mode: 'publish' | 'change'; open?: boolean }) =>
    mount(PublishDialog, {
        props: { open: true, ...props },
        attachTo: document.body,
    });

const option = (value: CardStyle) => document.querySelector(`[data-testid="card-style-${value}"]`) as HTMLElement;
const pressed = () =>
    [...document.querySelectorAll('[data-testid^="card-style-"]')]
        .filter((el) => el.getAttribute('data-state') === 'on')
        .map((el) => el.getAttribute('data-testid'));
const confirm = () => document.querySelector('[data-testid="publish-confirm"]') as HTMLButtonElement;

const settle = async () => {
    await nextTick();
    await nextTick();
};

afterEach(() => {
    document.body.innerHTML = '';
});

describe('PublishDialog', () => {
    it('preselects the stored card style', async () => {
        mountDialog({ cardStyle: '3d', mode: 'publish' });
        await settle();
        expect(pressed()).toEqual(['card-style-3d']);
    });

    it('emits the chosen style on confirm', async () => {
        const wrapper = mountDialog({ cardStyle: '2d', mode: 'publish' });
        await settle();
        option('3d').click();
        await settle();
        confirm().click();
        await settle();
        expect(wrapper.emitted('confirm')).toEqual([['3d']]);
    });

    it('keeps the choice when the pressed option is clicked again', async () => {
        const wrapper = mountDialog({ cardStyle: '2d', mode: 'publish' });
        await settle();
        option('2d').click();
        await settle();
        confirm().click();
        await settle();
        expect(wrapper.emitted('confirm')).toEqual([['2d']]);
    });

    it('resets to the stored style each time it opens', async () => {
        const wrapper = mountDialog({ cardStyle: '2d', mode: 'publish' });
        await settle();
        option('3d').click();
        await settle();
        await wrapper.setProps({ open: false });
        await settle();
        await wrapper.setProps({ open: true });
        await settle();
        expect(pressed()).toEqual(['card-style-2d']);
    });

    it('names its action by mode', async () => {
        mountDialog({ cardStyle: '2d', mode: 'publish' });
        await settle();
        expect(document.body.textContent).toContain('Publish team');
        expect(confirm().textContent?.trim()).toBe('Publish');
        document.body.innerHTML = '';

        mountDialog({ cardStyle: '2d', mode: 'change' });
        await settle();
        expect(document.body.textContent).toContain('Change link preview');
        expect(confirm().textContent?.trim()).toBe('Update preview');
    });
});
