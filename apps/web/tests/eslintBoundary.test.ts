// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';

// The lint rule that keeps three.js behind the lazy 3D component (#300).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: root });

const restricted = async (code: string, file: string): Promise<boolean> => {
    const [result] = await eslint.lintText(code, { filePath: resolve(root, file) });
    return result.messages.some((message) => message.ruleId === 'no-restricted-imports');
};

describe('the three.js lint boundary', { timeout: 30_000 }, () => {
    it.for([
        ["import { x } from '../three/renderer/shared';", 'src/views/x.ts'],
        ["import '../../three/scene/teamScene';", 'src/components/TeamBuilder/x.ts'],
        ["import T from '@/components/scene3d/TeamScene3D.vue';", 'src/views/x.ts'],
        ["import T from './TeamScene3D.vue';", 'src/components/scene3d/x.ts'],
        ["import P from './PersonPreview3D.vue';", 'src/components/scene3d/x.ts'],
        // index.ts is in the page's own chunk: a static import there is the leak to catch.
        ["import T from './TeamScene3D.vue';", 'src/components/scene3d/index.ts'],
    ])('blocks %s in %s', async ([code, file]) => {
        expect(await restricted(code, file)).toBe(true);
    });

    it.for([
        ["import { TeamScene3DAsync } from '@/components/scene3d';", 'src/views/x.ts'],
        ["import D from '@/components/TeamBuilder/TeamScene3DDialog.vue';", 'src/views/x.ts'],
        ["import { x } from '../../three/renderer/shared';", 'src/components/scene3d/x.ts'],
        // Only literal dots: a package folder called three is someone else's.
        ["import x from 'ab/three';", 'src/views/x.ts'],
        ["import x from 'ab/TeamScene3Dvue';", 'src/views/x.ts'],
    ])('allows %s in %s', async ([code, file]) => {
        expect(await restricted(code, file)).toBe(false);
    });

    it('allows the real scene3d/index.ts, whose scene imports are dynamic', async () => {
        const file = 'src/components/scene3d/index.ts';
        expect(await restricted(readFileSync(resolve(root, file), 'utf8'), file)).toBe(false);
    });
});
