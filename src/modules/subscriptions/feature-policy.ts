import { and, desc, eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import { subscriptionPlans, userSubscriptions } from '../../db/schema/index.js';

/** Port dari SubscriptionFeaturePolicy.java (-1 = tak terbatas). */
export interface PlanPermissions {
  maxRooms: number; maxStaff: number; maxUploadPhotoSizeMb: number;
  canExportData: boolean; canCustomizeQRTemplate: boolean; canWhatsAppNotify: boolean;
  canCustomLogoBranding: boolean; canAnalyticsDashboard: boolean;
}

const FREE: PlanPermissions = {
  maxRooms: 5, maxStaff: 0, maxUploadPhotoSizeMb: 0, canExportData: false, canCustomizeQRTemplate: false,
  canWhatsAppNotify: false, canCustomLogoBranding: false, canAnalyticsDashboard: false,
};

export function permissionsForPlanName(planName: string | null | undefined): PlanPermissions {
  const name = (planName ?? 'free').toLowerCase();
  if (name.includes('enterprise') || name.includes('ultimate'))
    return { maxRooms: -1, maxStaff: -1, maxUploadPhotoSizeMb: 10, canExportData: true, canCustomizeQRTemplate: true, canWhatsAppNotify: true, canCustomLogoBranding: true, canAnalyticsDashboard: true };
  if (name.includes('business') || name.includes('pro'))
    return { maxRooms: 30, maxStaff: 5, maxUploadPhotoSizeMb: 5, canExportData: true, canCustomizeQRTemplate: true, canWhatsAppNotify: true, canCustomLogoBranding: false, canAnalyticsDashboard: false };
  if (name.includes('starter'))
    return { maxRooms: 15, maxStaff: 2, maxUploadPhotoSizeMb: 2, canExportData: true, canCustomizeQRTemplate: true, canWhatsAppNotify: false, canCustomLogoBranding: false, canAnalyticsDashboard: false };
  return FREE;
}

/** Izin dari langganan ACTIVE terbaru user; tanpa langganan = Free. */
export async function getActivePermissions(db: DbOrTx, userId: number): Promise<PlanPermissions> {
  const [row] = await db.select({ name: subscriptionPlans.name }).from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.status, 'ACTIVE')))
    .orderBy(desc(userSubscriptions.id)).limit(1);
  return row ? permissionsForPlanName(row.name) : FREE;
}
