import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import { userSubscriptions } from '../../db/schema/index.js';

const GRACE_DAYS = 7;

/**
 * Layanan properti ditangguhkan bila pemilik tidak punya langganan ACTIVE yang belum berakhir
 * dan langganan terakhirnya sudah lewat masa tenggang 7 hari (atau tidak pernah berlangganan).
 */
export async function isOwnerSuspended(db: DbOrTx, ownerId: number, now = new Date()): Promise<boolean> {
  const subs = await db.select().from(userSubscriptions).where(eq(userSubscriptions.userId, ownerId));
  if (subs.some((s) => s.status.toUpperCase() === 'ACTIVE' && s.endDate > now)) return false;
  if (subs.length === 0) return true;
  const latestEnd = Math.max(...subs.map((s) => s.endDate.getTime()));
  return now.getTime() > latestEnd + GRACE_DAYS * 86_400_000;
}
