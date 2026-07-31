import { access, copyFile, cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const staging = join(root, '.github-pages-build');
const excluded = new Set(['.git', '.github-pages-build', 'dist', 'node_modules']);

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

async function assertFile(path, label) {
  try {
    await access(path);
  } catch {
    throw new Error(`${label} is missing: ${path}`);
  }
}

async function resolveAstroBin() {
  const packagePath = join(root, 'node_modules', 'astro', 'package.json');
  await assertFile(packagePath, 'Astro package metadata');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  const binEntry = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.astro;
  if (!binEntry) throw new Error('Unable to resolve the Astro CLI from node_modules/astro/package.json');
  const binPath = join(dirname(packagePath), binEntry);
  await assertFile(binPath, 'Astro CLI');
  return binPath;
}

async function stageProject() {
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    await cp(join(root, entry.name), join(staging, entry.name), {
      recursive: entry.isDirectory(),
      force: true,
      preserveTimestamps: true,
    });
  }

  const githubConfig = join(staging, 'astro.config.github.mjs');
  const defaultConfig = join(staging, 'astro.config.mjs');
  await assertFile(githubConfig, 'GitHub Pages Astro config');

  // Use Astro's default config filename inside staging. This avoids platform-
  // dependent resolution of an absolute --config path on GitHub Actions.
  await copyFile(githubConfig, defaultConfig);
  await assertFile(defaultConfig, 'Staged Astro config');
}

try {
  const astroBin = await resolveAstroBin();
  await stageProject();

  const env = { GITHUB_PAGES: 'true' };
  await run(process.execPath, [join(staging, 'scripts', 'prepare-github-pages.mjs')], staging, env);

  // prepare-github-pages.mjs must never remove or rename the staged config.
  await assertFile(join(staging, 'astro.config.mjs'), 'Staged Astro config after preparation');

  // --root tells Astro where the copied project lives. Astro then loads the
  // default astro.config.mjs relative to that root.
  await run(process.execPath, [astroBin, 'build', '--root', staging], root, env);
  await run(process.execPath, [join(staging, 'scripts', 'github-pages-postbuild.mjs')], staging, env);
  await run(process.execPath, [join(staging, 'scripts', 'validate-github-pages-build.mjs')], staging, env);

  await rm(join(root, 'dist'), { recursive: true, force: true });
  await cp(join(staging, 'dist'), join(root, 'dist'), { recursive: true, force: true });
  console.log(`GitHub Pages build copied to ${join(root, 'dist')}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
