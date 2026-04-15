import { BotRadioService } from '../services/BotRadioService';
import { logger } from '../utils/logger';

export class BotRadioCLI {
  private service: BotRadioService;

  constructor() {
    this.service = new BotRadioService();
  }

  async start(roomName: string, playlistUrl: string): Promise<void> {
    try {
      await this.service.startBot(roomName, playlistUrl);
      console.log(`Bot started in room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to start bot: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async stop(roomName: string): Promise<void> {
    try {
      await this.service.stopBot(roomName);
      console.log(`Bot stopped in room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to stop bot: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async status(): Promise<void> {
    try {
      const status = this.service.getStatus();
      if (status.length === 0) {
        console.log('No active bots');
        return;
      }

      console.log('Active Bots:');
      status.forEach(bot => {
        console.log(`Room: ${bot.roomName}`);
        if (bot.currentTrack) {
          console.log(`  Now Playing: ${bot.currentTrack.title} - ${bot.currentTrack.artist}`);
        }
        console.log(`  Queue: ${bot.queueLength} tracks`);
        console.log('');
      });
    } catch (error) {
      console.error(`Failed to get status: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async queue(roomName: string): Promise<void> {
    try {
      const queue = this.service.getQueue(roomName);
      if (queue.length === 0) {
        console.log(`No tracks in queue for room: ${roomName}`);
        return;
      }

      console.log(`Queue for room: ${roomName}`);
      queue.forEach((track, index) => {
        console.log(`${index + 1}. ${track.title} - ${track.artist} (${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')})`);
      });
    } catch (error) {
      console.error(`Failed to get queue: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async skip(roomName: string): Promise<void> {
    try {
      await this.service.skipTrack(roomName);
      console.log(`Skipped track in room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to skip track: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async pause(roomName: string): Promise<void> {
    try {
      await this.service.pausePlayback(roomName);
      console.log(`Paused playback in room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to pause playback: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async resume(roomName: string): Promise<void> {
    try {
      await this.service.resumePlayback(roomName);
      console.log(`Resumed playback in room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to resume playback: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async add(roomName: string, playlistUrl: string): Promise<void> {
    try {
      await this.service.addPlaylist(roomName, playlistUrl);
      console.log(`Added playlist to room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to add playlist: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async remove(roomName: string, trackIndex: number): Promise<void> {
    try {
      await this.service.removeTrack(roomName, trackIndex);
      console.log(`Removed track at index ${trackIndex} from room: ${roomName}`);
    } catch (error) {
      console.error(`Failed to remove track: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}