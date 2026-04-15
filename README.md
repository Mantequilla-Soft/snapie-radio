# Bot-Radio

Automated audio streaming bot for Hive Hangouts LiveKit rooms. This service allows bots to join LiveKit rooms and stream audio content from various sources like YouTube playlists.

## Features

- Join LiveKit rooms as virtual participants
- Stream audio from YouTube playlists
- Command-line interface for playlist management
- PM2 process management
- Extensible audio source architecture
- Real-time queue management

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your LiveKit credentials
   ```

## Usage

### CLI Commands

```bash
# Start a bot in a room with a playlist
bot-radio start <room-name> <playlist-url>

# Stop a bot in a room
bot-radio stop <room-name>

# Show status of all active bots
bot-radio status

# Show queue for a room
bot-radio queue <room-name>

# Skip current track
bot-radio skip <room-name>

# Pause/resume playback
bot-radio pause <room-name>
bot-radio resume <room-name>

# Add playlist to queue
bot-radio add <room-name> <playlist-url>

# Remove track from queue
bot-radio remove <room-name> <track-index>
```

### PM2 Deployment

```bash
# Start with PM2
npm run pm2:start

# Monitor processes
pm2 monit

# View logs
pm2 logs bot-radio
```

## Development

```bash
# Run in development mode
npm run dev

# Run CLI in development
npm run cli

# Run tests
npm test

# Lint code
npm run lint
```

## Configuration

Environment variables:

- `LIVEKIT_URL`: LiveKit server URL
- `LIVEKIT_API_KEY`: LiveKit API key
- `LIVEKIT_API_SECRET`: LiveKit API secret
- `BOT_USERNAME`: Bot username
- `BOT_PASSWORD`: Bot password
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## Architecture

The system consists of:

- **BotRadioService**: Core service managing bots and rooms
- **Audio Sources**: Modular providers for different streaming services
- **Queue Manager**: Handles playlist and track sequencing
- **LiveKit Integration**: Real-time audio publishing to rooms
- **CLI Interface**: Command-line management tool

## Audio Sources

Currently supported:
- YouTube (videos and playlists)

Planned:
- Spotify
- SoundCloud
- Local files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License

## Documentation

See [internal-docs/bot-radio-whitepaper.md](internal-docs/bot-radio-whitepaper.md) for detailed technical specifications.