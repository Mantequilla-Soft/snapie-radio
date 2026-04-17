import { EventEmitter } from 'events';
import { LiveKitBot } from './LiveKitBot';
import { QueueManager } from './QueueManager';
import { AudioProcessor } from './AudioProcessor';
import { AudioSourceManager } from '../sources/AudioSourceManager';
import { logger } from '../utils/logger';
import { TrackInfo } from '../sources/AudioSource';

export interface RoomStatus {
  roomName: string;
  active: boolean;
  currentTrack: TrackInfo | null;
  queue: TrackInfo[];
  paused: boolean;
}

export class BotRadioService extends EventEmitter {
  private bots: Map<string, LiveKitBot> = new Map();
  private queues: Map<string, QueueManager> = new Map();
  private processors: Map<string, AudioProcessor> = new Map();
  private playingRooms: Set<string> = new Set(); // rooms actively running the playback chain
  private sourceManager: AudioSourceManager;

  constructor() {
    super();
    this.sourceManager = new AudioSourceManager();
  }

  async start(): Promise<void> {
    logger.info('Bot-Radio service started');
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
    this.playingRooms.clear();
    logger.info('Bot-Radio service stopped');
  }

  async startBot(roomName: string, playlistUrl: string): Promise<void> {
    if (this.bots.has(roomName)) {
      throw new Error(`Bot already running in room: ${roomName}`);
    }

    const source = this.sourceManager.getSourceForUrl(playlistUrl);
    if (!source) throw new Error(`No audio source found for URL: ${playlistUrl}`);

    const playlist = await source.getPlaylist(playlistUrl);

    const queue = new QueueManager();
    queue.addPlaylist(playlist);

    const bot = new LiveKitBot();
    const processor = new AudioProcessor(bot, source);

    this.bots.set(roomName, bot);
    this.queues.set(roomName, queue);
    this.processors.set(roomName, processor);

    await bot.joinRoom(roomName);

    // Fire-and-forget — returns immediately after joining
    this.runPlaybackChain(roomName).catch((err) => {
      logger.error(`Playback chain error in ${roomName}:`, err);
      this.emit('error', { room: roomName, message: err.message });
    });

    logger.info(`Bot started in room: ${roomName} with playlist: ${playlist.title}`);
    this.emit('queue:update', { room: roomName });
  }

  async stopBot(roomName: string): Promise<void> {
    const bot = this.bots.get(roomName);
    if (!bot) throw new Error(`No bot running in room: ${roomName}`);

    await bot.leaveRoom();
    this.bots.delete(roomName);
    this.queues.delete(roomName);
    this.processors.delete(roomName);
    this.playingRooms.delete(roomName);
    logger.info(`Bot stopped in room: ${roomName}`);
    this.emit('queue:update', { room: roomName });
  }

  async skipTrack(roomName: string): Promise<void> {
    const bot = this.bots.get(roomName);
    if (!bot) throw new Error(`No bot running in room: ${roomName}`);
    // Interrupt current stream — the playback chain catches this and advances naturally
    await bot.skipCurrentTrack();
    logger.info(`Skipped track in room: ${roomName}`);
  }

  async pausePlayback(roomName: string): Promise<void> {
    const processor = this.processors.get(roomName);
    if (!processor) throw new Error(`No processor found for room: ${roomName}`);
    await processor.pause();
    logger.info(`Playback paused in room: ${roomName}`);
    this.emit('paused', { room: roomName });
  }

  async resumePlayback(roomName: string): Promise<void> {
    const processor = this.processors.get(roomName);
    if (!processor) throw new Error(`No processor found for room: ${roomName}`);
    await processor.resume();
    logger.info(`Playback resumed in room: ${roomName}`);
    this.emit('resumed', { room: roomName });
  }

  async addPlaylist(roomName: string, playlistUrl: string): Promise<void> {
    const queue = this.queues.get(roomName);
    if (!queue) throw new Error(`No queue found for room: ${roomName}`);

    const source = this.sourceManager.getSourceForUrl(playlistUrl);
    if (!source) throw new Error(`No audio source found for URL: ${playlistUrl}`);

    const playlist = await source.getPlaylist(playlistUrl);
    queue.addPlaylist(playlist);
    logger.info(`Added ${playlist.tracks.length} tracks to room: ${roomName}`);
    this.emit('queue:update', { room: roomName });

    // If the playback chain already finished (queue was empty), restart it
    if (!this.playingRooms.has(roomName)) {
      this.runPlaybackChain(roomName).catch((err) => {
        logger.error(`Playback chain error in ${roomName}:`, err);
      });
    }
  }

  getStatus(): RoomStatus[] {
    const status: RoomStatus[] = [];
    for (const [roomName, queue] of this.queues) {
      status.push({
        roomName,
        active: this.bots.has(roomName),
        currentTrack: queue.getCurrentTrack(),
        queue: queue.getQueue(),
        paused: false,
      });
    }
    return status;
  }

  getQueue(roomName: string): TrackInfo[] {
    return this.queues.get(roomName)?.getQueue() ?? [];
  }

  // ── Internal playback chain ────────────────────────────────────────────────

  private async runPlaybackChain(roomName: string): Promise<void> {
    if (this.playingRooms.has(roomName)) return; // already running
    this.playingRooms.add(roomName);

    try {
      while (true) {
        const queue = this.queues.get(roomName);
        if (!queue) break;

        const track = queue.next();
        if (!track) break; // queue exhausted

        await this.playTrack(roomName, track);
      }
    } finally {
      this.playingRooms.delete(roomName);
      logger.info(`Playback chain ended for room: ${roomName}`);
      this.emit('queue:empty', { room: roomName });
    }
  }

  private async playTrack(roomName: string, track: TrackInfo): Promise<void> {
    const processor = this.processors.get(roomName);
    if (!processor) return;

    logger.info(`Playing track: ${track.title} - ${track.artist}`);
    this.emit('track:start', { room: roomName, track });

    try {
      await processor.playTrack(track);
    } catch (err: any) {
      // A skipped track throws — treat it as "move on" not a fatal error
      logger.info(`Track ended (skip or error) in ${roomName}: ${err.message}`);
    }

    this.emit('track:end', { room: roomName });
    this.emit('queue:update', { room: roomName });
  }
}
