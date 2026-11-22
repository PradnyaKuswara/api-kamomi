import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  DB_URL: z.string().min(1),
  DB_USERNAME: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  /** Ukuran pool koneksi. Default kecil agar tidak menghabiskan max_connections Postgres saat dev/hot reload. */
  DB_POOL_MAX: z.coerce.number().int().positive().default(5),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(0),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 byte'),
  JWT_EXPIRATION: z.coerce.number().int().positive(),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:8080/login/oauth2/code/google'),
  MAIL_HOST: z.string().default('smtp.gmail.com'),
  MAIL_PORT: z.coerce.number().int().default(587),
  MAIL_USERNAME: z.string().default(''),
  MAIL_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().default('noreply@kamomi.com'),
  FRONTEND_URL: z.string().url().default('http://localhost:4321'),
  /** true bila di belakang reverse proxy tepercaya (nginx/Cloudflare): req.ip memakai X-Forwarded-For. */
  TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  RATE_LIMIT: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${detail}`);
  }
  return parsed.data;
}

/** Terima URL JDBC (jdbc:postgresql://...) maupun postgres:// */
export function toPgConnection(env: Pick<Env, 'DB_URL' | 'DB_USERNAME' | 'DB_PASSWORD'>): string {
  const url = new URL(env.DB_URL.replace(/^jdbc:/, ''));
  if (env.DB_USERNAME) url.username = env.DB_USERNAME;
  if (env.DB_PASSWORD) url.password = env.DB_PASSWORD;
  url.protocol = 'postgres:';
  return url.toString();
}
