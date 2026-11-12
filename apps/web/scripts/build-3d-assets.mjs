// Rebuilds the 3D body asset from the Quaternius "Universal Base Characters"
// pack (CC0, free Standard tier: https://quaternius.itch.io/universal-base-characters).
// Download and unzip the pack, then:
//
//   node scripts/build-3d-assets.mjs "<path to Universal Base Characters[Standard]>"
//
// The output is committed; this only needs running when the source changes.
// It uses @gltf-transform/cli through pnpm dlx, so the repo takes no new
// dependency: prune, meshopt compression, WebP textures at 1024 px.
//
// The hair GLBs in src/three/assets/hair/ were not produced by this script:
// they were optimised with gltf-transform on feat/3d-spike (commit 99c0653f)
// from the same pack's hair GLTFs and copied verbatim.
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = '@gltf-transform/cli@4.5.1';
const BODIES = [{ source: 'Superhero_Male_FullBody.gltf', output: 'athletic-male.glb' }];

const pack = process.argv[2];
if (!pack || !existsSync(pack)) {
    console.error('Usage: node scripts/build-3d-assets.mjs "<path to Universal Base Characters[Standard]>"');
    process.exit(1);
}
const sourceDir = join(pack, 'Base Characters', 'Godot - UE');
const outDir = fileURLToPath(new URL('../src/three/assets/', import.meta.url));

for (const { source, output } of BODIES) {
    const gltfPath = join(sourceDir, source);
    // The glTF names some textures "X_png.png" while the pack ships "X.png".
    const gltf = JSON.parse(readFileSync(gltfPath, 'utf8'));
    for (const { uri } of gltf.images ?? []) {
        const wanted = join(dirname(gltfPath), uri);
        const shipped = join(dirname(gltfPath), uri.replace(/_png\.png$/, '.png'));
        if (!existsSync(wanted) && existsSync(shipped)) copyFileSync(shipped, wanted);
    }
    const target = join(outDir, output);
    // On Windows pnpm is a .cmd, which needs a shell, and the shell doesn't
    // quote arguments: the pack's folders have spaces in their names.
    const quote = (arg) => (process.platform === 'win32' ? `"${arg}"` : arg);
    execFileSync(
        'pnpm',
        ['dlx', CLI, 'optimize', quote(gltfPath), quote(target), '--compress', 'meshopt', '--texture-compress', 'webp',
            '--texture-size', '1024', '--simplify', 'false', '--join', 'false', '--flatten', 'false', '--instance', 'false'],
        { stdio: 'inherit', shell: process.platform === 'win32' },
    );
    console.log(`${output}: ${Math.round(statSync(target).size / 1024)} KB`);
}
