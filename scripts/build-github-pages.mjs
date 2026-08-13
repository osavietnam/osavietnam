import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = resolve(projectRoot, 'temp_/github-pages-build');
const temporarySource = resolve(temporaryRoot, 'src');
const environment = {
  ...process.env,
  GITHUB_PAGES: 'true',
  GITHUB_SRC_DIR: temporarySource,
};

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} exited with code ${result.status}`);
}

try {
  await rm(temporaryRoot, { recursive: true, force: true });
  await cp(resolve(projectRoot, 'src'), temporarySource, { recursive: true });
  runNode(resolve(projectRoot, 'scripts/prepare-github-pages.mjs'));
  runNode(resolve(projectRoot, 'node_modules/astro/astro.js'), [
    'build',
    '--config',
    'astro.config.github.mjs',
  ]);
  runNode(resolve(projectRoot, 'scripts/github-pages-postbuild.mjs'));
  runNode(resolve(projectRoot, 'scripts/validate-github-pages-build.mjs'));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
