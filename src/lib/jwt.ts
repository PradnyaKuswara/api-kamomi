import { SignJWT, jwtVerify } from 'jose';

/**
 * Kompatibel dengan jjwt `Keys.hmacShaKeyFor(secret.getBytes(UTF_8))`:
 * algoritma dipilih dari panjang key (>=64 byte HS512, >=48 HS384, selainnya HS256),
 * sehingga token yang diterbitkan backend Java tetap valid.
 */
function algFor(secret: string): 'HS256' | 'HS384' | 'HS512' {
  const bytes = Buffer.byteLength(secret, 'utf8');
  if (bytes >= 64) return 'HS512';
  if (bytes >= 48) return 'HS384';
  return 'HS256';
}

export interface JwtOptions { secret: string; expirationMs: number }

export async function signToken(email: string, { secret, expirationMs }: JwtOptions, now = Date.now()): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: algFor(secret) })
    .setSubject(email)
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor((now + expirationMs) / 1000))
    .sign(new TextEncoder().encode(secret));
}

/** Mengembalikan email (subject) bila token valid, selain itu null. */
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: [algFor(secret)] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
