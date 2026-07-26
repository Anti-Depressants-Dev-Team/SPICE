import { createWriteStream } from 'node:fs';
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
  throw new Error('The universal macOS FFmpeg helper must run on macOS.');
}

const execFileAsync = promisify(execFile);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ffmpegRoot = path.resolve(appRoot, '..', '..', 'node_modules', 'ffmpeg-static');
const ffmpegPackage = JSON.parse(await readFile(path.join(ffmpegRoot, 'package.json'), 'utf8'));
const packageConfig = ffmpegPackage['ffmpeg-static'];
const release = process.env.FFMPEG_BINARY_RELEASE || packageConfig['binary-release-tag'];
const downloadsOrigin = (
  process.env.FFMPEG_BINARIES_URL
  || 'https://github.com/eugeneware/ffmpeg-static/releases/download'
).replace(/\/+$/, '');
const releaseOrigin = `${downloadsOrigin}/${release}`;
const scratchRoot = await mkdtemp(path.join(os.tmpdir(), 'spice-macos-ffmpeg-'));
const x64Binary = path.join(scratchRoot, 'ffmpeg-x64');
const arm64Binary = path.join(scratchRoot, 'ffmpeg-arm64');
const outputBinary = path.join(ffmpegRoot, 'ffmpeg');

try {
  await Promise.all([
    downloadGzip(`${releaseOrigin}/ffmpeg-darwin-x64.gz`, x64Binary),
    downloadGzip(`${releaseOrigin}/ffmpeg-darwin-arm64.gz`, arm64Binary),
  ]);

  await execFileAsync('/usr/bin/lipo', [
    '-create',
    '-output',
    outputBinary,
    x64Binary,
    arm64Binary,
  ]);
  await chmod(outputBinary, 0o755);

  const [{ stdout: architectures }, license, x64Readme, arm64Readme] = await Promise.all([
    execFileAsync('/usr/bin/lipo', ['-archs', outputBinary]),
    downloadText(`${releaseOrigin}/darwin-x64.LICENSE`),
    downloadText(`${releaseOrigin}/darwin-x64.README`),
    downloadText(`${releaseOrigin}/darwin-arm64.README`),
  ]);
  if (!architectures.includes('x86_64') || !architectures.includes('arm64')) {
    throw new Error(`Universal FFmpeg is missing an architecture: ${architectures.trim()}`);
  }

  await Promise.all([
    writeFile(`${outputBinary}.LICENSE`, license),
    writeFile(
      `${outputBinary}.README`,
      `SPICE universal macOS FFmpeg (${architectures.trim()})\n\n`
        + `x86_64 source notice:\n${x64Readme}\n\narm64 source notice:\n${arm64Readme}\n`,
    ),
  ]);
  console.log(`Prepared universal macOS FFmpeg: ${architectures.trim()}`);
} finally {
  await rm(scratchRoot, { recursive: true, force: true });
}

async function downloadGzip(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body),
    createGunzip(),
    createWriteStream(destination, { mode: 0o755 }),
  );
}

async function downloadText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  }
  return response.text();
}
