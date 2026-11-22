import type { DbOrTx } from '../../db/client.js';
import { getActivePermissions } from './feature-policy.js';
import { isOwnerSuspended } from './suspension.js';

/** Pembungkus berinstance untuk kebijakan paket (izin fitur & status suspend pemilik). */
export class SubscriptionPolicy {
  constructor(private readonly db: DbOrTx) {}
  permissions(userId: number) { return getActivePermissions(this.db, userId); }
  isSuspended(ownerId: number) { return isOwnerSuspended(this.db, ownerId); }
}
