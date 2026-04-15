import 'dotenv/config';
import { BotRadioService } from './services/BotRadioService';
import { logger } from './utils/logger';

async function main() {
  try {
    const service = new BotRadioService();
    await service.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await service.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await service.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start Bot-Radio service:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}