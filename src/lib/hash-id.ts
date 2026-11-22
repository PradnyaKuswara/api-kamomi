import { createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * Port persis dari HashUtil.java: AES-128/ECB/PKCS5 dengan key tetap, output base64url tanpa padding.
 * Kode room publik yang sudah tercetak di QR harus tetap valid, jadi algoritma tidak boleh diubah.
 */
const KEY = Buffer.from('KamomiSecretKeyQ', 'utf8');

export function encryptId(id: number): string {
  const c = createCipheriv('aes-128-ecb', KEY, null);
  return Buffer.concat([c.update(String(id), 'utf8'), c.final()]).toString('base64url');
}

export function decryptId(code: string): number | null {
  try {
    const d = createDecipheriv('aes-128-ecb', KEY, null);
    const n = Number(Buffer.concat([d.update(Buffer.from(code, 'base64url')), d.final()]).toString('utf8'));
    return Number.isSafeInteger(n) ? n : null;
  } catch {
    return null;
  }
}
