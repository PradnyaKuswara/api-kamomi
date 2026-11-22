import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { runBootstrap } from './db/bootstrap.js';

const env = loadEnv();
const app = await buildApp({ env });
// Sama seperti CommandLineRunner di Java: pastikan paket langganan & menu panduan ada setiap start.
await runBootstrap(app.db, app.log);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: env.PORT, host: '0.0.0.0' });
