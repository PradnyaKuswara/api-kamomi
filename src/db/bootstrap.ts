import { and, eq } from 'drizzle-orm';
import type { DbOrTx } from './client.js';
import { faqs, menuSections, menus, roleMenus, roles, subscriptionPlans } from './schema/index.js';

/* ---------------------------- Subscription plans ---------------------------- */
const PLANS = [
  { name: 'Free', price: 0, maxRooms: 5, description: 'Paket dasar gratis untuk pengelola kost pemula (1-5 kamar)',
    features: ['Kelola hingga 5 kamar', '1 Akun Pemilik', 'Digital Guestbook & Info Kamar', 'Sistem Laporan Keluhan Guest', 'Template QR Card Standar (Watermark Kamomi)', 'Dukungan Komunitas / FAQ'] },
  { name: 'Starter', price: 49000, maxRooms: 15, description: 'Paket ekonomis cocok untuk pengelola kost skala kecil-menengah',
    features: ['Kelola hingga 15 kamar', 'Up to 2 Akun Staff', 'Upload Foto Bukti Keluhan (Max 2MB)', 'Cetak Batch / Download QR Massal (PDF A4)', 'Unlock Rekap Export Data (Excel / CSV)', 'Template QR Card Premium (Watermark Kecil)', 'Support Email'] },
  { name: 'Business', price: 99000, maxRooms: 30, description: 'Paket bisnis populer dengan integrasi Notifikasi WhatsApp Otomatis',
    features: ['Kelola hingga 30 kamar', 'Up to 5 Akun Staff', 'Upload Foto Bukti Keluhan (Max 5MB)', 'EKSKLUSIF: Notifikasi WhatsApp Otomatis (Keluhan & Status)', 'Semua fitur Paket Starter', 'Support Email & Chat Fast Response'] },
  { name: 'Enterprise', price: 199000, maxRooms: -1, description: 'Paket terlengkap tanpa batas untuk kost besar, homestay, atau villa',
    features: ['UNLIMITED KAMAR', 'UNLIMITED AKUN STAFF', 'Upload Foto Bukti Keluhan (Max 10MB)', 'EKSKLUSIF: Notifikasi WhatsApp Otomatis (Keluhan & Status)', 'EKSKLUSIF: Custom Branding & Upload Logo Kost (Bebas Watermark)', 'EKSKLUSIF: Dashboard Analitik Respon Perbaikan', 'Priority Support (WhatsApp 24/7)'] },
];

/** Sama dengan seedSubscriptionPlans(): dibuat bila belum ada, selalu ditimpa ke nilai default saat startup. */
export async function ensureSubscriptionPlans(db: DbOrTx) {
  for (const p of PLANS) {
    const [existing] = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans).where(eq(subscriptionPlans.name, p.name)).limit(1);
    const values = { price: p.price, description: p.description, maxRooms: p.maxRooms, billingCycle: 'MONTHLY', features: p.features, isActive: true, updatedAt: new Date() };
    if (existing) await db.update(subscriptionPlans).set(values).where(eq(subscriptionPlans.id, existing.id));
    else await db.insert(subscriptionPlans).values({ name: p.name, createdAt: new Date(), ...values });
  }
}

/* ---------------------------------- Menus ----------------------------------- */
async function section(db: DbOrTx, title: string, orderNo: number) {
  const [found] = await db.select().from(menuSections).where(eq(menuSections.title, title)).limit(1);
  if (found) return found;
  const [created] = await db.insert(menuSections).values({ title, orderNo, isActive: true, createdAt: new Date(), updatedAt: new Date() }).returning();
  return created!;
}

async function menu(db: DbOrTx, title: string, url: string, icon: string, orderNo: number, sectionId: number) {
  const [found] = await db.select().from(menus).where(eq(menus.title, title)).limit(1);
  const values = { url, icon, orderNo, sectionId, updatedAt: new Date() };
  if (found) return (await db.update(menus).set(values).where(eq(menus.id, found.id)).returning())[0]!;
  return (await db.insert(menus).values({ title, isActive: true, createdAt: new Date(), ...values }).returning())[0]!;
}

async function grant(db: DbOrTx, roleName: string, menuId: number) {
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
  if (!role) return;
  const [has] = await db.select({ id: roleMenus.id }).from(roleMenus).where(and(eq(roleMenus.roleId, role.id), eq(roleMenus.menuId, menuId))).limit(1);
  if (!has) await db.insert(roleMenus).values({ roleId: role.id, menuId });
}

/** Menu "Panduan Fasilitas" ditambahkan di setiap startup untuk DB lama (ensureGuidesMenu). */
export async function ensureGuidesMenu(db: DbOrTx) {
  const hunian = await section(db, 'Manajemen Hunian', 2);
  const m = await menu(db, 'Panduan Fasilitas', '/dashboard/guides', 'book-open', 8, hunian.id);
  await grant(db, 'ADMIN', m.id);
  await grant(db, 'USER', m.id);
}

/** Dipanggil setiap server start, sama seperti CommandLineRunner di Java. Kegagalan menu tidak menghentikan server. */
export async function runBootstrap(db: DbOrTx, log: { error: (o: unknown, m: string) => void } = console as never) {
  await ensureSubscriptionPlans(db);
  try { await ensureGuidesMenu(db); } catch (err) { log.error({ err }, 'Failed to ensure Panduan Fasilitas menu'); }
}

/* ----------------------------------- Seed ----------------------------------- */
export async function seedRoles(db: DbOrTx) {
  for (const name of ['SUPER_ADMIN', 'ADMIN', 'USER']) {
    const [has] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1);
    if (!has) await db.insert(roles).values({ name, createdAt: new Date(), updatedAt: new Date() });
  }
}

const FAQS: [string, string, string, number][] = [
  ['Akun', 'Bagaimana cara mendaftar di Kamomi?', "Untuk mendaftar, klik tombol 'Daftar' di halaman utama, isi formulir dengan nama, email, dan kata sandi Anda, lalu klik 'Buat Akun'. Anda juga bisa mendaftar menggunakan akun Google.", 1],
  ['Akun', 'Apakah saya bisa login menggunakan akun Google?', "Ya, Kamomi mendukung login melalui Google OAuth. Klik tombol 'Masuk dengan Google' di halaman login untuk menggunakan fitur ini.", 2],
  ['Akun', 'Bagaimana cara mengganti kata sandi akun saya?', "Saat ini fitur ganti kata sandi tersedia melalui halaman pengaturan akun. Masuk ke profil Anda, lalu pilih 'Ubah Kata Sandi' dan ikuti langkah yang tertera.", 3],
  ['Akun', 'Apa yang harus saya lakukan jika lupa kata sandi?', "Klik 'Lupa Kata Sandi' di halaman login, masukkan email terdaftar Anda, dan kami akan mengirimkan tautan reset kata sandi ke email tersebut.", 4],
  ['Properti & Kamar', 'Bagaimana cara menambahkan properti baru?', "Setelah login, masuk ke menu 'Properti', lalu klik tombol 'Tambah Properti'. Isi detail properti seperti nama, alamat, dan jenis properti, kemudian simpan.", 1],
  ['Properti & Kamar', 'Berapa jumlah kamar maksimal yang bisa saya kelola?', 'Jumlah kamar yang dapat Anda kelola bergantung pada paket langganan yang aktif. Paket Free mendukung hingga 3 kamar, Starter 10 kamar, Pro 30 kamar, dan Business tanpa batas.', 2],
  ['Properti & Kamar', 'Bagaimana cara menambahkan tata tertib ke kamar?', "Buka detail kamar yang ingin diubah, lalu pilih tab 'Tata Tertib'. Anda dapat memilih tata tertib yang sudah dibuat dari daftar master, atau tambahkan tata tertib baru terlebih dahulu.", 3],
  ['Properti & Kamar', 'Apa itu QR Card dan bagaimana cara menggunakannya?', 'QR Card adalah kartu digital yang berisi informasi kamar dan Wi-Fi dalam bentuk kode QR. Tamu dapat memindai QR Code ini untuk melihat informasi kamar secara langsung tanpa perlu login.', 4],
  ['Langganan', 'Apa saja paket langganan yang tersedia?', 'Kamomi menyediakan 4 paket: Free (gratis, hingga 3 kamar), Starter (Rp 49.000/bulan, hingga 10 kamar), Pro (Rp 99.000/bulan, hingga 30 kamar), dan Business (Rp 249.000/bulan, kamar tidak terbatas).', 1],
  ['Langganan', 'Apakah ada masa percobaan gratis?', 'Ya! Setiap pengguna baru secara otomatis mendapatkan paket Free tanpa biaya yang bisa digunakan selamanya dengan fitur dasar hingga 3 kamar.', 2],
  ['Langganan', 'Bagaimana cara upgrade paket langganan?', "Masuk ke menu 'Langganan' di dashboard Anda, pilih paket yang diinginkan, lalu ikuti proses pembayaran yang tersedia.", 3],
  ['Teknis', 'Apakah Kamomi tersedia sebagai aplikasi mobile?', 'Saat ini Kamomi tersedia sebagai aplikasi web yang dioptimalkan untuk perangkat mobile. Aplikasi native untuk iOS dan Android sedang dalam tahap pengembangan.', 1],
  ['Teknis', 'Apakah data saya aman di Kamomi?', 'Ya, kami menggunakan enkripsi data dan protokol keamanan standar industri. Kata sandi disimpan dalam format terenkripsi dan tidak bisa dibaca oleh siapapun.', 2],
  ['Teknis', 'Bagaimana cara menghubungi tim dukungan Kamomi?', "Anda dapat menghubungi kami melalui menu 'Bantuan' di aplikasi, atau email ke support@kamomi.id. Tim kami siap membantu Senin–Jumat pukul 09.00–17.00 WIB.", 3],
  ['Teknis', 'Apa yang harus saya lakukan jika QR Code tidak berfungsi?', 'Pastikan kamera perangkat Anda berfungsi dengan baik dan izin kamera sudah diberikan. Jika masalah berlanjut, coba segarkan halaman atau hubungi pengelola properti Anda.', 4],
];

export async function seedFaqs(db: DbOrTx) {
  if ((await db.select({ id: faqs.id }).from(faqs).limit(1)).length > 0) return;
  await db.insert(faqs).values(FAQS.map(([category, question, answer, sequence]) => ({
    category, question, answer, sequence, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  })));
}

export async function seedMenus(db: DbOrTx) {
  const utama = await section(db, 'Utama', 1);
  const hunian = await section(db, 'Manajemen Hunian', 2);
  const pengguna = await section(db, 'Manajemen Pengguna', 3);
  const lainnya = await section(db, 'Lainnya', 4);

  const [legacy] = await db.select().from(menus).where(eq(menus.title, 'Kelola Staff / User')).limit(1);
  if (legacy) await db.update(menus).set({ title: 'Management Users' }).where(eq(menus.id, legacy.id));

  const all = [
    await menu(db, 'Dashboard', '/dashboard', 'dashboard', 1, utama.id),
    await menu(db, 'Room', '/dashboard/rooms', 'door-open', 2, hunian.id),
    await menu(db, 'Rules', '/dashboard/rules', 'file-text', 3, hunian.id),
    await menu(db, 'Contacts', '/dashboard/contacts', 'phone', 7, hunian.id),
    await menu(db, 'Settings Account', '/dashboard/settings', 'user-cog', 4, lainnya.id),
    await menu(db, 'Bantuan / FAQ', '/dashboard/faq', 'help-circle', 5, lainnya.id),
    await menu(db, 'Management Users', '/dashboard/users', 'users', 6, pengguna.id),
    await menu(db, 'Panduan Fasilitas', '/dashboard/guides', 'book-open', 8, hunian.id),
    await menu(db, 'Keluhan', '/dashboard/complaints', 'alert-triangle', 9, hunian.id),
    await menu(db, 'Aktivitas Notifikasi', '/dashboard/notifications', 'bell', 10, lainnya.id),
  ];
  for (const m of all) {
    await grant(db, 'ADMIN', m.id);
    if (m.title !== 'Management Users') await grant(db, 'USER', m.id); // USER tidak melihat Management Users
  }
}

export async function runSeed(db: DbOrTx) {
  await seedRoles(db);
  await seedFaqs(db);
  await seedMenus(db);
}
