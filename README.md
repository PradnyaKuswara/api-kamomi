# api-kamomi

Rewrite backend Kamomi (Spring Boot) ke **Fastify 5 + TypeScript + Drizzle ORM**. Kontrak API dipertahankan
kompatibel dengan frontend Astro (`http://localhost:4321`).

## Menjalankan

```bash
pnpm install
cp .env.example .env      # isi DB_URL dll. (format JDBC lama tetap diterima)
pnpm dev                  # tsx watch
pnpm test                 # Vitest + PGlite (Postgres in-process, tanpa Docker / DB asli)
pnpm typecheck && pnpm lint && pnpm build && pnpm start
pnpm seed                 # roles, FAQ, menu (idempoten). Setara `--seed` di versi Java
```

Setiap start server menjalankan `runBootstrap` (paket langganan + menu "Panduan Fasilitas"), sama seperti
`DataInitializer` di Java.

## Database

- Semua tabel ada di schema Postgres **`kamomi`** (bukan `public`).
- `drizzle/0000_*.sql` adalah migrasi **baseline** dari skema Drizzle (`CREATE TABLE` biasa).
  **Jangan dijalankan ke DB yang sudah berisi tabel dari versi Java.** DB lama dipakai apa adanya;
  migrasi hanya untuk DB kosong/baru dan sebagai acuan. Tandai baseline sebagai sudah diterapkan sebelum
  memakai `db:migrate` pada DB lama.
- Verifikasi skema terhadap DB nyata: `node --env-file=.env node_modules/drizzle-kit/bin.cjs pull`
  (butuh `schemaFilter: ['kamomi']`, sudah di `drizzle.config.ts`), lalu bandingkan dengan `src/db/schema`.

## Kompatibilitas dengan versi Java

Dipertahankan: envelope `{success, code, message, data, errors}`; HTTP 200 dengan `code` 201 pada create;
Page JSON ala Spring (`content`, `totalElements`, ...); jsonb sebagai **teks JSON** (`features`, `oldData`, `newData`);
JWT HS256/384/512 sesuai panjang secret dan subject = email (token lama tetap valid); hash BCrypt;
kode room publik (AES-128/ECB, `HashUtil`); `?token=` untuk SSE; endpoint publik (`/api/public/**`) membungkus
error di HTTP 200.

## Perbedaan yang disengaja (perbaikan keamanan / bug)

| Area | Java | Di sini |
|---|---|---|
| Isolasi antar-pemilik | Semua `ADMIN` bisa membaca/ubah properti & room siapa pun | Harus anggota `property_users` properti tsb (`modules/properties/access.ts`); SUPER_ADMIN bebas |
| `/api/roles` | Tanpa cek role | ADMIN/SUPER_ADMIN |
| `/api/menus/user/{id}/sidebar`, `/user-overrides` | Tanpa cek | Sidebar: diri sendiri/admin; override: admin |
| Rule pada room | Boleh rule properti lain | Hanya rule properti yang sama |
| Penugasan staf saat membuat room | User mana pun | Hanya anggota properti |
| Reset password code | `java.util.Random` | `crypto.randomInt` |
| Error `IllegalArgumentException` | HTTP 500 | HTTP 400 (pesan di `message` dan `errors`) |
| Hapus data yang masih dipakai (FK) | 500 | 409 |
| Tanpa token | 403 kosong | 401 dengan envelope |
| `createdBy/updatedBy` di plan | Entity User penuh (termasuk hash password) | `{id, name, email}` |
| Rate limit | Tidak ada | login/register/forgot/reset, keluhan publik, room publik |

## Catatan

- `DataInitializer` di Java menimpa paket langganan ke nilai default **setiap start**; perilaku ini dipertahankan,
  artinya perubahan harga oleh SUPER_ADMIN akan kembali ke default saat restart.
- Seed 100 "Seed Rule" untuk Property ID=2 (data uji pagination) tidak di-port.
- Set `TRUST_PROXY=true` bila di belakang reverse proxy agar rate limit & log IP memakai IP klien asli.
