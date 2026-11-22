/**
 * Di versi Java kolom jsonb dipetakan ke String, sehingga API mengembalikan TEKS JSON
 * (mis. "features": "{\"a\":1}"), bukan objek. Drizzle mengembalikan objek ter-parse,
 * jadi untuk kompatibilitas dengan frontend kita serialisasi ulang di batas respons.
 */
export const toJsonText = (v: unknown): string | null => (v === null || v === undefined ? null : JSON.stringify(v));

/** Kebalikannya untuk menulis: terima teks JSON dari request, simpan sebagai nilai jsonb. */
export function fromJsonText(v: string | null | undefined): unknown {
  if (v === null || v === undefined || v === '') return null;
  try { return JSON.parse(v); } catch { return v; }
}
