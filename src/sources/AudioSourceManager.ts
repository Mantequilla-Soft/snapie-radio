import { AudioSource } from './AudioSource';
import { YouTubeSource } from './YouTubeSource';

export class AudioSourceManager {
  private sources: AudioSource[] = [
    new YouTubeSource(),
    // Add more sources here
  ];

  getSourceForUrl(url: string): AudioSource | null {
    return this.sources.find(source => source.canHandle(url)) || null;
  }

  getAllSources(): AudioSource[] {
    return [...this.sources];
  }
}