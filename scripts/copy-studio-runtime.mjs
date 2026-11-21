import { cp, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = resolve(projectRoot, 'dist');
const runtimeTrees = ['src/content', 'src/data', 'src/assets', 'public'];

await stat(resolve(outputRoot, 'server/entry.mjs'));

for (const tree of runtimeTrees) {
  const source = resolve(projectRoot, tree);
  const destination = resolve(outputRoot, tree);
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

console.log(`Content Studio runtime data copied: ${runtimeTrees.join(', ')}`);
