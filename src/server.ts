import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { BotRadioService } from './services/BotRadioService';
import { logger } from './utils/logger';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const botService = new BotRadioService();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Broadcast helpers ────────────────────────────────────────────────────────

function broadcastState() {
  io.emit('state', botService.getStatus());
}

// Relay all bot events to every connected browser
botService.on('track:start', (data) => { io.emit('track:start', data); broadcastState(); });
botService.on('track:end',   (data) => { io.emit('track:end', data);   broadcastState(); });
botService.on('queue:update',(data) => { io.emit('queue:update', data); broadcastState(); });
botService.on('queue:empty', (data) => { io.emit('queue:empty', data);  broadcastState(); });
botService.on('error',       (data) => { io.emit('bot:error', data); });

// ── REST API ─────────────────────────────────────────────────────────────────

app.post('/api/start', async (req, res) => {
  const { room, url } = req.body;
  if (!room || !url) return void res.status(400).json({ error: 'room and url required' });
  try {
    await botService.startBot(room, url);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('startBot error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stop', async (req, res) => {
  const { room } = req.body;
  try {
    await botService.stopBot(room);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/add', async (req, res) => {
  const { room, url } = req.body;
  if (!room || !url) return void res.status(400).json({ error: 'room and url required' });
  try {
    await botService.addPlaylist(room, url);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/skip', async (req, res) => {
  const { room } = req.body;
  try {
    await botService.skipTrack(room);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pause', async (req, res) => {
  const { room } = req.body;
  try {
    await botService.pausePlayback(room);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/resume', async (req, res) => {
  const { room } = req.body;
  try {
    await botService.resumePlayback(room);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/state', (_req, res) => res.json(botService.getStatus()));

// ── WebSocket ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.emit('state', botService.getStatus());
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown() {
  logger.info('Shutting down...');
  await botService.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Boot ──────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
  console.log(`\n🎵  Snapie Radio  →  http://localhost:${PORT}\n`);
});
