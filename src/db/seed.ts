import { loadEnv } from '../config/env.js';
import { createDb } from './client.js';
import { runBootstrap, runSeed } from './bootstrap.js';

// Setara `--seed` di versi Java. Aman dijalankan berulang (idempoten).
// Seed 100 "Seed Rule" untuk Property ID=2 (data uji pagination) sengaja tidak ikut di-port.
const { pool, db } = createDb(loadEnv());
try {
  console.log('Initiating Database Seeding...');
  await runSeed(db);
  await runBootstrap(db);
  console.log('Database Seeding Completed.');
} finally {
  await pool.end();
}
