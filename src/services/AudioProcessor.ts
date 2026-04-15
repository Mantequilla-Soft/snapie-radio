import { Readable } from 'stream';
import { LiveKitBot } from './LiveKitBot';
import { AudioSource, TrackInfo } from '../sources/AudioSource';
import { logger } from '../utils/logger';

export class AudioProcessor {
  private livekitBot: LiveKitBot;
  private currentSource: AudioSource;
  private isPaused = false;

  constructor(livekitBot: LiveKitBot, source: AudioSource) {
    this.livekitBot = livekitBot;
    this.currentSource = source;
  }

  async playTrack(track: TrackInfo): Promise<void> {
    try {
      logger.info(`Playing track: ${track.title} - ${track.artist}`);

      const stream: Readable = await this.currentSource.getTrackStream(track.id);
      await this.livekitBot.publishAudio(stream);

      this.isPaused = false;
    } catch (error) {
      logger.error(`Failed to play track ${track.title}:`, error);
      throw error;
    }
  }

  async pause(): Promise<void> {
    // Implementation depends on LiveKit audio track controls
    this.isPaused = true;
    logger.info('Audio playback paused');
  }

  async resume(): Promise<void> {
    // Implementation depends on LiveKit audio track controls
    this.isPaused = false;
    logger.info('Audio playback resumed');
  }

  async stop(): Promise<void> {
    // Stop current audio track
    this.isPaused = false;
    logger.info('Audio playback stopped');
  }
}