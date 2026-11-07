// After `vite build`: three.js must never reach the entry chunk or anything
// it preloads, and the lazy 3D chunk must stay within budget. The 3D chunk
// is found by SCENE_CHUNK_MARKER (src/three/renderer/shared.ts), a string
// literal minification can't rename.
//
//   node scripts/check-bundle.mjs              # no 3D chunk yet is fine
//   node scripts/check-bundle.mjs --require-3d # the 3D chunk must exist
//   node scripts/check-bundle.mjs --dist <dir> # check another build (tests)
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'nba-central-3d-chunk';
const BUDGET = 300 * 1024;
const distFlag = process.argv.indexOf('--dist');
const dist = distFlag > -1 ? process.argv[distFlag + 1] : fileURLToPath(new URL('../dist/', import.meta.url));
const requireChunk = process.argv.includes('--require-3d');

const fail = (message) => {
    console.error(`check-bundle: ${message}`);
    process.exit(1);
};

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const eager = [
    ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
    ...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
].map((match) => match[1].split('/').pop());

// A check that found nothing to check must not pass.
if (eager.length === 0) fail('no entry scripts found in index.html; the build layout may have changed.');

for (const file of eager) {
    const code = readFileSync(join(dist, 'assets', file), 'utf8');
    if (code.includes(MARKER) || code.includes('WebGLRenderer')) {
        fail(`${file} loads with the page but contains three.js. Keep 3D behind the lazy scene3d component.`);
    }
}

const chunks = readdirSync(join(dist, 'assets')).filter((file) => file.endsWith('.js'));
const sceneChunk = chunks.find((file) => readFileSync(join(dist, 'assets', file), 'utf8').includes(MARKER));

if (!sceneChunk) {
    if (requireChunk) fail('no 3D chunk found, but --require-3d was given.');
    console.log(`check-bundle: ${eager.length} eager files clean; no 3D chunk.`);
    process.exit(0);
}

const gzipped = gzipSync(readFileSync(join(dist, 'assets', sceneChunk))).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
if (gzipped > BUDGET) fail(`${sceneChunk} is ${kb(gzipped)} gzipped, over the ${kb(BUDGET)} budget.`);
console.log(`check-bundle: ${eager.length} eager files clean; 3D chunk ${sceneChunk} is ${kb(gzipped)} gzipped.`);
