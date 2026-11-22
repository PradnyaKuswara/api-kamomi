import { defineConfig } from 'drizzle-kit';
import { toPgConnection } from './src/config/env.js';

// `generate` tidak butuh koneksi; `migrate`/`pull` membaca DB_URL dari environment.
const url = process.env.DB_URL
  ? toPgConnection({ DB_URL: process.env.DB_URL, DB_USERNAME: process.env.DB_USERNAME, DB_PASSWORD: process.env.DB_PASSWORD })
  : 'postgres://localhost:5432/kamomi';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['kamomi'],
  dbCredentials: { url },
});
