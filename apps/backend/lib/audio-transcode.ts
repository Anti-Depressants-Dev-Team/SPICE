import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';

import { audioContentDisposition } from './audio-download.ts';

const MAX_FFMPEG_ERROR_LENGTH = 16_384;

type Mp3DownloadOptions = {
  sourceUrl: string;
  title?: string | null;
  userAgent: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

type FfmpegPathOptions = {
  bundledPath?: string | null;
  explicitPath?: string | null;
};

export function ffmpegExecutableCandidates({
  bundledPath = null,
}: Pick<FfmpegPathOptions, 'bundledPath'> = {}) {
  return typeof bundledPath === 'string' && bundledPath.trim()
    ? [bundledPath.trim()]
    : [];
}

export function resolveFfmpegPath(options: FfmpegPathOptions = {}) {
  const explicitPath = options.explicitPath === undefined
    ? process.env.SPICE_FFMPEG_PATH?.trim()
    : options.explicitPath?.trim();
  const candidates = explicitPath
    ? [explicitPath]
    : ffmpegExecutableCandidates(options);
  const resolved = candidates[0];

  if (resolved) return resolved;

  throw new Error(
    explicitPath
      ? 'SPICE_FFMPEG_PATH must point to an FFmpeg executable.'
      : 'MP3 conversion is unavailable because the packaged FFmpeg executable could not be found.',
  );
}

export function mp3TranscodeArgs(sourceUrl: string, userAgent: string) {
  const source = URL.parse(sourceUrl);
  if (!source || (source.protocol !== 'http:' && source.protocol !== 'https:')) {
    throw new Error('Only HTTP(S) audio sources can be converted.');
  }

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-user_agent',
    userAgent,
    '-reconnect',
    '1',
    '-reconnect_streamed',
    '1',
    '-reconnect_delay_max',
    '5',
    '-protocol_whitelist',
    'http,https,tcp,tls,crypto',
    '-i',
    source.toString(),
    '-map',
    '0:a:0',
    '-vn',
    '-map_metadata',
    '-1',
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '2',
    '-f',
    'mp3',
    'pipe:1',
  ];
}

export async function createMp3DownloadResponse({
  sourceUrl,
  title,
  userAgent,
  headers,
  signal,
}: Mp3DownloadOptions) {
  const ffmpegPath = resolveFfmpegPath();
  if (signal?.aborted) {
    throw new Error('The MP3 conversion request was cancelled.');
  }

  const output = new PassThrough();
  const child = Reflect.apply(spawn, undefined, [
    ffmpegPath,
    mp3TranscodeArgs(sourceUrl, userAgent),
    {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  ]) as ChildProcessWithoutNullStreams;
  let stderr = '';

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    if (stderr.length < MAX_FFMPEG_ERROR_LENGTH) {
      stderr += chunk.slice(0, MAX_FFMPEG_ERROR_LENGTH - stderr.length);
    }
  });

  await new Promise<void>((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', (error) => reject(new Error(
      `MP3 conversion could not start the packaged FFmpeg executable at ${ffmpegPath}: ${error.message}`,
    )));
  });

  const stopConversion = () => {
    if (!child.killed) child.kill('SIGKILL');
  };
  signal?.addEventListener('abort', stopConversion, { once: true });
  output.once('close', stopConversion);

  child.stdout.pipe(output, { end: false });
  child.once('error', (error) => output.destroy(error));
  child.once('close', (code, closeSignal) => {
    signal?.removeEventListener('abort', stopConversion);
    if (code === 0) {
      output.end();
      return;
    }

    const detail = stderr.trim();
    output.destroy(new Error(
      detail || `FFmpeg exited with ${closeSignal ? `signal ${closeSignal}` : `code ${code ?? 'unknown'}`}.`,
    ));
  });

  return new Response(Readable.toWeb(output) as ReadableStream<Uint8Array>, {
    headers: {
      ...headers,
      'Cache-Control': 'no-store',
      'Content-Disposition': audioContentDisposition(title, 'mp3'),
      'Content-Type': 'audio/mpeg',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
