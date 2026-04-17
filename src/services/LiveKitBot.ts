import {
  Room,
  RoomEvent,
  LocalAudioTrack,
  AudioSource,
  AudioFrame,
  TrackSource,
  TrackPublishOptions,
} from '@livekit/rtc-node';
import { AccessToken } from 'livekit-server-sdk';
import { logger } from '../utils/logger';
import { Readable } from 'stream';
import { spawn } from 'child_process';

const SAMPLE_RATE = 48000;
const NUM_CHANNELS = 2; // stereo
// 20ms frame at 48kHz
const SAMPLES_PER_FRAME = 960;
const BYTES_PER_FRAME = SAMPLES_PER_FRAME * NUM_CHANNELS * 2; // Int16 = 2 bytes

export class LiveKitBot {
  private room: Room | null = null;
  private audioSource: AudioSource | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  private activeStream: Readable | null = null;

  async joinRoom(roomName: string, token?: string): Promise<void> {
    const accessToken = token || (await this.generateToken(roomName));

    this.room = new Room();

    this.room.on(RoomEvent.Disconnected, () => {
      logger.info(`Bot disconnected from room: ${roomName}`);
    });

    await this.room.connect(process.env.LIVEKIT_URL!, accessToken, {
      autoSubscribe: false,
      dynacast: false,
    });

    this.audioSource = new AudioSource(SAMPLE_RATE, NUM_CHANNELS);
    this.audioTrack = LocalAudioTrack.createAudioTrack('radio-audio', this.audioSource);

    const opts = new TrackPublishOptions();
    opts.source = TrackSource.SOURCE_MICROPHONE;
    await this.room.localParticipant?.publishTrack(this.audioTrack, opts);

    logger.info(`Bot joined room: ${roomName}`);
  }

  /**
   * Decode compressed audio from nodeStream via ffmpeg and push PCM frames
   * to the LiveKit AudioSource.  Resolves when the track ends.
   *
   * IMPORTANT: every AudioFrame must own its Int16Array (byteOffset === 0).
   * The rtc-node FFI passes `data.buffer` directly to Rust, ignoring byteOffset.
   * Using a subarray view into a larger Buffer causes it to read from byte 0
   * of the parent ArrayBuffer — producing noise.  We avoid this by allocating
   * a fresh Int16Array per frame and reading with readInt16LE().
   */
  async publishAudio(nodeStream: Readable): Promise<void> {
    if (!this.audioSource) {
      throw new Error('Bot not connected to room');
    }

    this.activeStream = nodeStream;
    const source = this.audioSource;

    // Spawn ffmpeg directly so we control the exact command
    const ffmpegProc = spawn('ffmpeg', [
      '-loglevel', 'error',
      '-i', 'pipe:0',       // read from stdin
      '-vn',                // no video
      '-f', 's16le',        // signed 16-bit little-endian PCM
      '-ar', String(SAMPLE_RATE),
      '-ac', String(NUM_CHANNELS),
      'pipe:1',             // write raw PCM to stdout
    ]);

    nodeStream.pipe(ffmpegProc.stdin!);
    ffmpegProc.stdin!.on('error', () => {}); // swallow EPIPE on early close
    ffmpegProc.stderr!.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) logger.warn(`ffmpeg: ${msg}`);
    });

    try {
      let carry = Buffer.alloc(0);

      for await (const chunk of ffmpegProc.stdout!) {
        carry = Buffer.concat([carry, chunk as Buffer]);

        while (carry.length >= BYTES_PER_FRAME) {
          // Allocate a fresh Int16Array with its own ArrayBuffer (byteOffset === 0).
          // This is required: rtc-node's FFI passes data.buffer directly to Rust
          // without honoring byteOffset, so a subarray view into a larger Buffer
          // would send the wrong bytes.
          const samples = new Int16Array(SAMPLES_PER_FRAME * NUM_CHANNELS);
          for (let i = 0; i < samples.length; i++) {
            samples[i] = carry.readInt16LE(i * 2);
          }
          carry = carry.subarray(BYTES_PER_FRAME);

          await source.captureFrame(new AudioFrame(samples, SAMPLE_RATE, NUM_CHANNELS, SAMPLES_PER_FRAME));
        }
      }
    } finally {
      this.activeStream = null;
    }
  }

  async skipCurrentTrack(): Promise<void> {
    if (this.activeStream) {
      this.activeStream.destroy(new Error('skipped'));
    }
  }

  async leaveRoom(): Promise<void> {
    if (this.activeStream) {
      this.activeStream.destroy();
      this.activeStream = null;
    }
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
      this.audioSource = null;
      this.audioTrack = null;
      logger.info('Bot left room');
    }
  }

  private async generateToken(roomName: string): Promise<string> {
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: process.env.BOT_USERNAME || 'radio-bot',
      },
    );

    token.addGrant({
      roomJoin: true,
      roomCreate: true,
      room: roomName,
      canPublish: true,
      canSubscribe: false,
    });

    return await token.toJwt();
  }
}
