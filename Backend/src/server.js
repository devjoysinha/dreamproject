import { app } from './app.js';
import { config } from './config.js';
import { closePool } from './db.js';
import { closeCache } from './cache.js';

const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`Dream backend listening at http://${config.HOST}:${config.PORT}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; closing backend.`);
  server.close(async () => {
    await closePool();
    await closeCache();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
