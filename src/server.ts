import 'dotenv/config';
import express from 'express';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from './utils/logger';

const execFileAsync = promisify(execFile);
const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// ── yt-dlp base args (cached singleton) ───────────────────────────────────────

let _baseArgs: string[] | null = null;

async function getBaseArgs(): Promise<string[]> {
  if (_baseArgs !== null) return _baseArgs;
  const args: string[] = [];

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE;
  if (cookiesFile) args.push('--cookies', cookiesFile);

  args.push('--extractor-args', 'youtube:player_client=tv_embedded,web');

  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--version']);
    const year = parseInt(stdout.trim().split('.')[0], 10);
    if (year >= 2024) {
      args.push(
        '--js-runtimes', `node:${process.execPath}`,
        '--remote-components', 'ejs:github',
      );
    }
  } catch { /* yt-dlp not found — will fail at request time with a clear error */ }

  _baseArgs = args;
  return args;
}

// ── Static files ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, '../public')));

// Expose server-side config to the browser without a build step
app.get('/config.js', (_req, res) => {
  res.type('application/javascript');
  res.send(`window.SNAPIE_CONFIG = ${JSON.stringify({
    hangoutsApiUrl: process.env.HANGOUTS_API_URL ?? 'https://api.hangouts.snapie.io',
    livekitUrl: process.env.LIVEKIT_URL ?? 'wss://livekit.3speak.tv',
  })};`);
});

// ── Audio stream proxy ─────────────────────────────────────────────────────────
//
// Streams any yt-dlp-supported URL as mp3 audio.
// The browser <audio> element fetches this and plays it.
// yt-dlp stdout → ffmpeg → response (chunked transfer encoding).

app.get('/stream', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return void res.status(400).json({ error: 'url required' });

  logger.info(`Stream request: ${url}`);

  try {
    const base = await getBaseArgs();

    const ytdlp = spawn('yt-dlp', [
      ...base,
      '-f', 'bestaudio',
      '-o', '-',
      '--no-playlist',
      '--quiet',
      url,
    ]);

    const ff = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-f', 'mp3',
      '-b:a', '192k',
      'pipe:1',
    ]);

    ytdlp.stdout.pipe(ff.stdin);

    ytdlp.stderr.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) logger.warn(`yt-dlp: ${msg}`);
    });

    ff.stderr.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) logger.warn(`ffmpeg: ${msg}`);
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    ff.stdout.pipe(res);

    // Clean up both processes when client disconnects
    req.on('close', () => {
      ytdlp.kill();
      ff.kill();
    });

    ytdlp.on('error', (err) => {
      logger.error('yt-dlp error:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    ff.on('error', (err) => {
      logger.error('ffmpeg error:', err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

  } catch (err: any) {
    logger.error('Stream setup error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ── Playlist resolver ─────────────────────────────────────────────────────────
//
// Resolves any yt-dlp-supported URL (playlist or single track) to a JSON list.

app.get('/api/playlist', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return void res.status(400).json({ error: 'url required' });

  logger.info(`Playlist request: ${url}`);

  try {
    const base = await getBaseArgs();
    const { stdout } = await execFileAsync('yt-dlp', [
      ...base,
      '--flat-playlist',
      '--dump-json',
      url,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const lines = stdout.trim().split('\n').filter(Boolean);
    const tracks = lines.map((line) => {
      const entry = JSON.parse(line);
      return {
        id: entry.id,
        title: entry.title ?? entry.id,
        artist: entry.channel ?? entry.uploader ?? 'Unknown',
        duration: entry.duration ?? 0,
        sourceUrl: entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`,
        thumbnail: entry.thumbnails?.[0]?.url
          ?? (entry.id ? `https://img.youtube.com/vi/${entry.id}/mqdefault.jpg` : null),
      };
    });

    if (tracks.length === 0) return void res.status(404).json({ error: 'No tracks found' });

    const first = JSON.parse(lines[0]);
    const title = first.playlist_title ?? first.playlist ?? tracks[0].title;

    res.json({ title, tracks });
  } catch (err: any) {
    logger.error('Playlist error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎵  Snapie Radio  →  http://localhost:${PORT}\n`);
});
