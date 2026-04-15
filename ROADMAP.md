# Snapie Radio — Roadmap

## Current State: MVP ✅

A CLI bot that joins a LiveKit room (Hive Hangouts) and streams audio from a YouTube playlist. It runs on a server, decodes audio via yt-dlp + ffmpeg, and publishes real-time PCM frames to LiveKit.

**Works today:**
- Join any LiveKit room by name
- Stream a YouTube playlist from start to finish
- Stereo audio at 48kHz, decoded and re-encoded via LiveKit's opus pipeline
- Automatic track advancement through the queue
- `install.sh` for one-command setup

---

## Phase 2 — Web Control Panel

The big one. A browser-based UI so anyone in the room can control the bot without touching a terminal.

### Core controls
- Play / Pause / Skip
- Volume slider (publish-side gain)
- Current track display with album art and progress bar
- Live queue viewer — see what's coming up

### Queue management
- Paste a YouTube URL (video or playlist) to add to the queue
- Drag-and-drop reorder
- Remove individual tracks
- "Play next" — jump a track to the front
- On-the-fly playlist building during a live session

### Search
- Search YouTube from inside the UI and add results directly to the queue — no URL copying needed

### Tech stack (proposed)
- **Frontend:** React + Tailwind (or SvelteKit for lighter weight)
- **Backend:** Express or Fastify — thin REST + WebSocket layer
- **Real-time sync:** WebSocket broadcast so every browser tab sees the same queue state instantly
- **Auth:** Simple shared room password (same concept as Hive Hangouts rooms)

---

## Phase 3 — Quality of Life

- **Multiple rooms:** one server instance managing bots in several rooms simultaneously, each with its own queue
- **Crossfade:** smooth 3-second fade between tracks
- **Volume normalization:** equalise loudness across tracks so you don't get blasted by one loud song
- **History:** "recently played" list per room
- **Voting / reactions:** room participants can thumbs-up/down the current track
- **Spotify / SoundCloud support:** plug in additional audio sources via the existing `AudioSource` interface

---

## Phase 4 — Hive Integration

Since this runs on Hive Hangouts infrastructure, there's a natural fit:
- Hive Keychain login — only Hive account holders can control the bot
- Tip the DJ — send HIVE/HBD to whoever queued the current track
- On-chain queue — queue entries stored as custom JSON operations so the history is permanent
- Community radio channels — persistent rooms tied to Hive communities

---

## Known Limitations (to fix before Phase 2 ships)

| Issue | Impact | Fix |
|---|---|---|
| No pause/resume on active track | Medium | Buffer current PCM position, mute frames instead of stopping |
| Volume control not wired up | Low | Apply gain multiplier to Int16 samples before `captureFrame` |
| No reconnect logic if bot drops | High | Watch `RoomEvent.Disconnected`, re-join and resume |
| Queue not persisted | Medium | Write queue state to a JSON file or SQLite |
| yt-dlp n-challenge warnings | Low | Solved with `--remote-components ejs:github` (already in code) |
