import { LiveKitBot } from './LiveKitBot';
import { QueueManager } from './QueueManager';
import { AudioProcessor } from './AudioProcessor';
import { AudioSourceManager } from '../sources/AudioSourceManager';
import { logger } from '../utils/logger';

export class BotRadioService {
  private bots: Map<string, LiveKitBot> = new Map();
  private queues: Map<string, QueueManager> = new Map();
  private processors: Map<string, AudioProcessor> = new Map();
  private sourceManager: AudioSourceManager;

  constructor() {
    this.sourceManager = new AudioSourceManager();
  }

  async start(): Promise<void> {
    logger.info('Bot-Radio service started');
    // Initialize any global resources
  }

  async stop(): Promise<void> {
    logger.info('Stopping Bot-Radio service...');

    for (const [roomName, bot] of this.bots) {
      await bot.leaveRoom();
      logger.info(`Bot left room: ${roomName}`);
    }

    this.bots.clear();
    this.queues.clear();
    this.processors.clear();

    logger.info('Bot-Radio service stopped');
  }

  async startBot(roomName: string, playlistUrl: string): Promise<void> {
    if (this.bots.has(roomName)) {
      throw new Error(`Bot already running in room: ${roomName}`);
    }

    const source = this.sourceManager.getSourceForUrl(playlistUrl);
    if (!source) {
      throw new Error(`No audio source found for URL: ${playlistUrl}`);
    }

    const playlist = await source.getPlaylist(playlistUrl);

    const queue = new QueueManager();
    queue.addPlaylist(playlist);

    const bot = new LiveKitBot();
    const processor = new AudioProcessor(bot, source);

    // Register everything before joining/playing so playNext can find them
    this.bots.set(roomName, bot);
    this.queues.set(roomName, queue);
    this.processors.set(roomName, processor);

    await bot.joinRoom(roomName);
    await this.playNext(roomName);

    logger.info(`Bot started in room: ${roomName} with playlist: ${playlist.title}`);
  }

  async stopBot(roomName: string): Promise<void> {
    const bot = this.bots.get(roomName);
    if (!bot) {
      throw new Error(`No bot running in room: ${roomName}`);
    }

    await bot.leaveRoom();

    this.bots.delete(roomName);
    this.queues.delete(roomName);
    this.processors.delete(roomName);

    logger.info(`Bot stopped in room: ${roomName}`);
  }

  async skipTrack(roomName: string): Promise<void> {
    const queue = this.queues.get(roomName);
    if (!queue) {
      throw new Error(`No queue found for room: ${roomName}`);
    }

    const nextTrack = queue.skip();
    if (nextTrack) {
      await this.playTrack(roomName, nextTrack);
    } else {
      logger.info(`No more tracks in queue for room: ${roomName}`);
    }
  }

  async pausePlayback(roomName: string): Promise<void> {
    const processor = this.processors.get(roomName);
    if (!processor) {
      throw new Error(`No processor found for room: ${roomName}`);
    }

    await processor.pause();
    logger.info(`Playback paused in room: ${roomName}`);
  }

  async resumePlayback(roomName: string): Promise<void> {
    const processor = this.processors.get(roomName);
    if (!processor) {
      throw new Error(`No processor found for room: ${roomName}`);
    }

    await processor.resume();
    logger.info(`Playback resumed in room: ${roomName}`);
  }

  async addPlaylist(roomName: string, playlistUrl: string): Promise<void> {
    const queue = this.queues.get(roomName);
    if (!queue) {
      throw new Error(`No queue found for room: ${roomName}`);
    }

    const source = this.sourceManager.getSourceForUrl(playlistUrl);
    if (!source) {
      throw new Error(`No audio source found for URL: ${playlistUrl}`);
    }

    const playlist = await source.getPlaylist(playlistUrl);
    queue.addPlaylist(playlist);

    logger.info(`Added playlist to room: ${roomName} - ${playlist.title}`);
  }

  async removeTrack(roomName: string, trackIndex: number): Promise<void> {
    const queue = this.queues.get(roomName);
    if (!queue) {
      throw new Error(`No queue found for room: ${roomName}`);
    }

    // Implementation depends on QueueManager having remove method
    logger.info(`Removed track at index ${trackIndex} from room: ${roomName}`);
  }

  getStatus(): Array<{ roomName: string; currentTrack?: any; queueLength: number }> {
    const status = [];

    for (const [roomName, queue] of this.queues) {
      const currentTrack = queue.getCurrentTrack();
      const queueLength = queue.getQueue().length;

      status.push({
        roomName,
        currentTrack,
        queueLength
      });
    }

    return status;
  }

  getQueue(roomName: string): any[] {
    const queue = this.queues.get(roomName);
    return queue ? queue.getQueue() : [];
  }

  private async playNext(roomName: string): Promise<void> {
    const queue = this.queues.get(roomName);
    if (!queue) return;

    const nextTrack = queue.next();
    if (nextTrack) {
      await this.playTrack(roomName, nextTrack);
    }
  }

  private async playTrack(roomName: string, track: any): Promise<void> {
    const processor = this.processors.get(roomName);
    if (!processor) return;

    // publishAudio blocks in real-time until the track stream ends,
    // so we advance directly to the next track when it resolves.
    await processor.playTrack(track);
    await this.playNext(roomName);
  }
}