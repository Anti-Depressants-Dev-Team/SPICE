import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.SPICE_LOCAL_PACKAGE_PLATFORM = 'macos';
await import('./package-local-windows.mjs');
await installMissingDarwinArchitectures();

async function installMissingDarwinArchitectures() {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repoRoot = path.resolve(appRoot, '..', '..');
  const runtimeRoot = path.join(appRoot, 'dist', 'spice-local-macos');
  const lock = JSON.parse(await readFile(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  const lockPackages = lock.packages || {};
  const missingByArchitecture = new Map([
    ['arm64', []],
    ['x64', []],
  ]);

  for (const [lockPath, metadata] of Object.entries(lockPackages)) {
    if (!lockPath.includes('node_modules/') || !metadata?.version) continue;

    const packageName = lockPath.slice(lockPath.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const architecture = packageName.endsWith('darwin-arm64')
      ? 'arm64'
      : packageName.endsWith('darwin-x64')
        ? 'x64'
        : null;
    if (!architecture) continue;

    const installedPath = path.join(runtimeRoot, ...lockPath.split('/'));
    if (!existsSync(installedPath)) continue;

    const counterpartArchitecture = architecture === 'arm64' ? 'x64' : 'arm64';
    const counterpartName = packageName.replace(
      `darwin-${architecture}`,
      `darwin-${counterpartArchitecture}`,
    );
    const counterpartLockPath = lockPath.slice(0, -packageName.length) + counterpartName;
    const counterpartPath = path.join(runtimeRoot, ...counterpartLockPath.split('/'));
    if (existsSync(counterpartPath)) continue;

    const counterpart = lockPackages[counterpartLockPath]
      || lockPackages[`node_modules/${counterpartName}`];
    if (!counterpart?.version) {
      throw new Error(`package-lock.json is missing the ${counterpartName} counterpart.`);
    }

    missingByArchitecture.get(counterpartArchitecture).push({
      name: counterpartName,
      version: counterpart.version,
      destination: counterpartPath,
    });
  }

  for (const [architecture, packages] of missingByArchitecture) {
    if (packages.length === 0) continue;
    await installArchitecturePackages(architecture, packages);
  }

  async function installArchitecturePackages(architecture, packages) {
    const scratch = await mkdtemp(path.join(os.tmpdir(), `spice-darwin-${architecture}-`));
    try {
      const dependencies = Object.fromEntries(
        packages.map(({ name, version }) => [name, version]),
      );
      await writeFile(
        path.join(scratch, 'package.json'),
        `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`,
      );
      await runNpmInstall(scratch, architecture);

      for (const { name, destination } of packages) {
        const source = path.join(scratch, 'node_modules', ...name.split('/'));
        if (!existsSync(source)) {
          throw new Error(`npm did not install the required ${name} package.`);
        }
        await mkdir(path.dirname(destination), { recursive: true });
        await cp(source, destination, { recursive: true, dereference: true });
      }
      console.log(
        `Added ${architecture} Darwin runtime dependencies: ${packages.map(({ name }) => name).join(', ')}`,
      );
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  }
}

async function runNpmInstall(cwd, architecture) {
  const npmCli = process.env.npm_execpath;
  const executable = npmCli
    ? process.execPath
    : process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm';
  const args = [
    ...(npmCli ? [npmCli] : []),
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--no-package-lock',
    '--include=optional',
    '--install-strategy=hoisted',
    // npm still applies the host CPU check to direct native packages in some
    // releases. This scratch install is lock-pinned and scripts are disabled,
    // so force only permits the intentional opposite-architecture payload.
    '--force',
    '--os=darwin',
    `--cpu=${architecture}`,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: {
        ...process.env,
        npm_config_workspaces: 'false',
      },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${executable} install for Darwin ${architecture} failed`
            + (signal ? ` with signal ${signal}` : ` with exit code ${code}`),
        ),
      );
    });
  });
}
