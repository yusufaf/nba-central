import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(__dirname, '../../scripts/check-bundle.mjs');
const dirs: string[] = [];

// A throwaway dist/ in a folder with a space in its name.
const makeDist = (html: string, assets: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'check bundle '));
    dirs.push(root);
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'index.html'), html);
    for (const [name, code] of Object.entries(assets)) writeFileSync(join(root, 'assets', name), code);
    return root;
};
const run = (dist: string, ...flags: string[]) => spawnSync(process.execPath, [script, '--dist', dist, ...flags], { encoding: 'utf8' });

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check-bundle', () => {
    it('passes a clean entry and an in-budget 3D chunk', () => {
        const dist = makeDist('<script type="module" crossorigin src="/assets/index-a.js"></script>', {
            'index-a.js': 'console.log(1)',
            'scene-b.js': 'const x = "nba-central-3d-chunk";',
        });
        const result = run(dist, '--require-3d');
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('scene-b.js');
    });

    it('fails when the entry chunk contains three.js', () => {
        const dist = makeDist('<script type="module" src="/assets/index-a.js"></script>', {
            'index-a.js': 'class WebGLRenderer {}',
        });
        expect(run(dist).status).toBe(1);
    });

    it('fails when it finds no eager files at all, rather than passing on nothing', () => {
        const dist = makeDist('<html><body>no scripts</body></html>', { 'scene-b.js': 'nba-central-3d-chunk' });
        const result = run(dist);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('no entry scripts');
    });
});
