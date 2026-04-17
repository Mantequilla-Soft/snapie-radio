import { Readable } from 'stream';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { AudioSource, PlaylistInfo, TrackInfo, TrackMetadata } from './AudioSource';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

// Build base args depending on the installed yt-dlp version.
// --no-js-runtimes / --js-runtimes were added in 2024; older builds don't know them.
async function buildBaseArgs(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--version']);
    const year = parseInt(stdout.trim().split('.')[0], 10);
    if (year >= 2024) {
      return [
        '--no-js-runtimes',
        '--js-runtimes', `node:${process.execPath}`,
        '--remote-components', 'ejs:github',
      ];
    }
  } catch { /* yt-dlp not found — will fail later with a clear message */ }
  return []; // old version: no JS-runtime flags, falls back to yt-dlp defaults
}

let _baseArgs: string[] | null = null;
async function getBaseArgs(): Promise<string[]> {
  if (_baseArgs === null) _baseArgs = await buildBaseArgs();
  return _baseArgs;
}

async function ytdlpJson(args: string[]): Promise<string> {
  const base = await getBaseArgs();
  const { stdout } = await execFileAsync('yt-dlp', [...base, ...args], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}

export class YouTubeSource implements AudioSource {
  name = 'YouTube';

  canHandle(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  async getPlaylist(url: string): Promise<PlaylistInfo> {
    logger.info(`Getting playlist info for URL: ${url}`);

    // --flat-playlist: don't download, just list entries.
    // --dump-json: one JSON object per line.
    const raw = await ytdlpJson([
      '--flat-playlist',
      '--dump-json',
      url,
    ]);

    const tracks: TrackInfo[] = raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const entry = JSON.parse(line);
        return {
          id: entry.id,
          title: entry.title ?? entry.id,
          artist: entry.channel ?? entry.uploader ?? 'Unknown',
          duration: entry.duration ?? 0,
          sourceUrl: entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`,
        };
      });

    if (tracks.length === 0) {
      throw new Error(`No tracks found for URL: ${url}`);
    }

    // Use playlist title if available (first entry may carry it), else first track title
    const firstEntry = JSON.parse(raw.trim().split('\n')[0]);
    const playlistTitle = firstEntry.playlist_title ?? firstEntry.playlist ?? tracks[0].title;

    logger.info(`Loaded ${tracks.length} tracks from: ${playlistTitle}`);
    return { title: playlistTitle, tracks };
  }

  async getTrackStream(trackId: string): Promise<Readable> {
    const url = `https://www.youtube.com/watch?v=${trackId}`;
    logger.info(`Spawning yt-dlp for track: ${trackId}`);

    const base = await getBaseArgs();
    const proc = spawn('yt-dlp', [
      ...base,
      '-f', 'bestaudio',
      '-o', '-',         // stream to stdout
      '--no-playlist',
      '--quiet',
      url,
    ]);

    proc.stderr.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) logger.warn(`yt-dlp: ${msg}`);
    });

    proc.on('error', (err) => {
      logger.error(`yt-dlp process error for ${trackId}:`, err);
    });

    return proc.stdout;
  }

  async getMetadata(trackId: string): Promise<TrackMetadata> {
    const raw = await ytdlpJson([
      '--dump-json',
      '--no-playlist',
      `https://www.youtube.com/watch?v=${trackId}`,
    ]);
    const info = JSON.parse(raw.trim());
    return {
      title: info.title,
      artist: info.channel ?? info.uploader ?? 'Unknown',
      duration: info.duration ?? 0,
      artworkUrl: info.thumbnail,
    };
  }
}
