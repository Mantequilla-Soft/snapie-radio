import ytdl from '@distube/ytdl-core';
import ytpl from 'ytpl';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { AudioSource, PlaylistInfo, TrackInfo, TrackMetadata } from './AudioSource';
import { logger } from '../utils/logger';

export class YouTubeSource implements AudioSource {
  name = 'YouTube';

  private readonly requestOptions = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Mode': 'navigate',
    }
  };

  canHandle(url: string): boolean {
    return ytdl.validateURL(url) || url.includes('youtube.com') || url.includes('youtu.be') || ytpl.validateID(url);
  }

  async getPlaylist(url: string): Promise<PlaylistInfo> {
    try {
      logger.info(`Getting playlist info for URL: ${url}`);
      
      // ytpl often fails with YouTube Mixes (RD...), so we check if it's a standard playlist first
      const isPlaylist = ytpl.validateID(url);
      logger.info(`Is standard playlist: ${isPlaylist}`);

      if (isPlaylist) {
        try {
          const playlist = await ytpl(url, { limit: 100 });
          const tracks: TrackInfo[] = playlist.items.map(item => ({
            id: item.id,
            title: item.title,
            artist: item.author.name,
            duration: this.parseDuration(item.duration),
            sourceUrl: item.shortUrl
          }));

          return {
            title: playlist.title,
            tracks
          };
        } catch (plError) {
          logger.warn(`ytpl failed to fetch playlist, falling back to single video: ${plError}`);
        }
      }

      // Single video fallback or for Mixes where we can at least play the first track
      const videoId = ytdl.getVideoID(url);
      logger.info(`Fetching info for single video ID: ${videoId}`);
      
      const info = await ytdl.getInfo(videoId, {
        requestOptions: this.requestOptions
      });

      const track: TrackInfo = {
        id: videoId,
        title: info.videoDetails.title,
        artist: info.videoDetails.author.name,
        duration: parseInt(info.videoDetails.lengthSeconds),
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`
      };

      return {
        title: info.videoDetails.title,
        tracks: [track]
      };
    } catch (error) {
      logger.error('Failed to get playlist info:', error);
      throw error;
    }
  }

  async getTrackStream(trackId: string): Promise<Readable> {
    const url = `https://www.youtube.com/watch?v=${trackId}`;
    logger.info(`Spawning yt-dlp for track: ${trackId}`);

    const nodePath = process.execPath;
    const proc = spawn('yt-dlp', [
      '--no-js-runtimes',
      '--js-runtimes', `node:${nodePath}`,
      '--remote-components', 'ejs:github',  // solve YouTube n-challenge for unthrottled download
      '-f', 'bestaudio',
      '-o', '-',            // stream to stdout
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
    try {
      const info = await ytdl.getInfo(trackId, {
        requestOptions: this.requestOptions
      });
      return {
        title: info.videoDetails.title,
        artist: info.videoDetails.author.name,
        duration: parseInt(info.videoDetails.lengthSeconds),
        artworkUrl: info.videoDetails.thumbnails[0]?.url
      };
    } catch (error) {
      logger.error(`Failed to get metadata for ${trackId}:`, error);
      throw error;
    }
  }

  private parseDuration(durationStr: string | null): number {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }
}