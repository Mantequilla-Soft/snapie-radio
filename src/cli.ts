#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { BotRadioCLI } from './cli/BotRadioCLI';

const program = new Command();

program
  .name('bot-radio')
  .description('Bot-Radio: Automated audio streaming for Hive Hangouts')
  .version('1.0.0');

program
  .command('start <roomName> <playlistUrl>')
  .description('Start bot in room with playlist')
  .action(async (roomName: string, playlistUrl: string) => {
    const cli = new BotRadioCLI();
    await cli.start(roomName, playlistUrl);
  });

program
  .command('stop <roomName>')
  .description('Stop bot in room')
  .action(async (roomName: string) => {
    const cli = new BotRadioCLI();
    await cli.stop(roomName);
  });

program
  .command('status')
  .description('Show all active bots')
  .action(async () => {
    const cli = new BotRadioCLI();
    await cli.status();
  });

program
  .command('queue <roomName>')
  .description('Show queue for room')
  .action(async (roomName: string) => {
    const cli = new BotRadioCLI();
    await cli.queue(roomName);
  });

program
  .command('skip <roomName>')
  .description('Skip current track')
  .action(async (roomName: string) => {
    const cli = new BotRadioCLI();
    await cli.skip(roomName);
  });

program
  .command('pause <roomName>')
  .description('Pause playback')
  .action(async (roomName: string) => {
    const cli = new BotRadioCLI();
    await cli.pause(roomName);
  });

program
  .command('resume <roomName>')
  .description('Resume playback')
  .action(async (roomName: string) => {
    const cli = new BotRadioCLI();
    await cli.resume(roomName);
  });

program
  .command('add <roomName> <playlistUrl>')
  .description('Add playlist to queue')
  .action(async (roomName: string, playlistUrl: string) => {
    const cli = new BotRadioCLI();
    await cli.add(roomName, playlistUrl);
  });

program
  .command('remove <roomName> <trackIndex>')
  .description('Remove track from queue')
  .action(async (roomName: string, trackIndex: string) => {
    const cli = new BotRadioCLI();
    await cli.remove(roomName, parseInt(trackIndex));
  });

program.parse();