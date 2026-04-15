export interface AudioSource {
  name: string;
  canHandle(url: string): boolean;
  getPlaylist(url: string): Promise<PlaylistInfo>;
  getTrackStream(trackId: string): Promise<import('stream').Readable>;
  getMetadata(trackId: string): Promise<TrackMetadata>;
}

export interface PlaylistInfo {
  title: string;
  tracks: TrackInfo[];
}

export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  duration: number;
  sourceUrl: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  album?: string;
  duration: number;
  artworkUrl?: string;
}