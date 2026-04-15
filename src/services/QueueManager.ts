import { TrackInfo } from '../sources/AudioSource';

export class QueueManager {
  private queue: TrackInfo[] = [];
  private currentIndex = -1;
  private isPlaying = false;

  addPlaylist(playlist: { tracks: TrackInfo[] }): void {
    this.queue.push(...playlist.tracks);
  }

  next(): TrackInfo | null {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      return this.queue[this.currentIndex];
    }
    return null; // End of queue
  }

  skip(): TrackInfo | null {
    return this.next();
  }

  getCurrentTrack(): TrackInfo | null {
    return this.currentIndex >= 0 ? this.queue[this.currentIndex] : null;
  }

  getQueue(): TrackInfo[] {
    return [...this.queue];
  }

  removeTrack(index: number): boolean {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
      if (index <= this.currentIndex) {
        this.currentIndex--;
      }
      return true;
    }
    return false;
  }

  clear(): void {
    this.queue = [];
    this.currentIndex = -1;
  }
}