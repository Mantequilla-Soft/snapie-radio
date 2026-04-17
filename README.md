# Snapie Radio — DJ Console

A browser-based DJ console for [Hive Hangouts](https://hangouts.snapie.io). Log in with your Hive Keychain, pick a live room, paste any URL, and broadcast music directly from your browser tab — no bots, no VPS required.

## How it works

The browser tab **is** the DJ. It authenticates with Hive Keychain, gets a LiveKit token from the Hangouts middleware, and joins the room directly via `livekit-client`. Audio is fetched from the server-side yt-dlp proxy (which handles YouTube, SoundCloud, Vimeo, Bandcamp, and 1000+ other sites) and streamed into the room in real time.

```
Browser (DJ Console)
  ├─ Keychain login → Hangouts API → JWT + LiveKit token
  ├─ GET /stream?url=... → server pipes yt-dlp audio → browser <audio>
  ├─ Web Audio API: <audio> → GainNode → MediaStreamDestination
  └─ livekit-client publishes MediaStream into the LiveKit room
```

## Requirements

- Node.js ≥ 18
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and on `$PATH`
- [ffmpeg](https://ffmpeg.org) installed and on `$PATH`
- Access to a running [Hive Hangouts](https://github.com/Mantequilla-Soft/hangouts) backend

## Installation

```bash
git clone https://github.com/Mantequilla-Soft/snapie-radio.git
cd snapie-radio
npm install
cp .env.example .env
# edit .env — see Configuration below
```

## Configuration

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description |
|---|---|
| `HANGOUTS_API_URL` | Hangouts API — defaults to `https://hangout-api.3speak.tv` |
| `LIVEKIT_URL` | LiveKit server WebSocket URL (passed to the browser) |
| `PORT` | HTTP port for the DJ console server (default: 3000) |
| `YOUTUBE_COOKIES_FILE` | *(optional)* Path to a Netscape cookies file for YouTube auth |

## Running

```bash
# Development
npm run web

# Production (built)
npm run build
npm start
```

Open `http://localhost:3000` (or your configured port) in a browser with the **Hive Keychain** extension installed.

## PM2 deployment

```bash
npm run pm2:start   # start
pm2 logs snapie-radio
pm2 monit
```

## Usage

1. **Login** — enter your Hive username and sign the challenge with Keychain
2. **Pick a room** — choose from live Hive Hangouts rooms or type a room name
3. **Add tracks** — paste any URL (YouTube playlist, SoundCloud track, Vimeo, Bandcamp…)
4. **Go** — press Play; the console streams audio into the LiveKit room

Controls: play/pause, previous, skip, volume slider, progress scrubber, per-track remove, double-click queue item to jump.

## Supported audio sources

Anything [yt-dlp supports](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) — YouTube, SoundCloud, Vimeo, Bandcamp, Twitch VODs, Twitter/X, and 1000+ more. Paste the URL and it resolves automatically.

## License

MIT
