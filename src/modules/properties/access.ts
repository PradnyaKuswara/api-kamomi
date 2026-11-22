import { and, eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client.js';
import { properties, propertyUsers, rooms, userRooms } from '../../db/schema/index.js';
import { ForbiddenError, NotFoundError } from '../../errors/app-error.js';
import type { AuthUser } from '../users/authz.js';

/**
 * Isolasi antar-tenant. Versi Java menganggap SEMUA user ber-role ADMIN boleh mengakses properti/room mana pun
 * (setiap pemilik properti ber-role ADMIN), sehingga pemilik A bisa membaca & mengubah data pemilik B.
 * Di sini ADMIN/USER harus tercatat di property_users untuk properti tersebut. SUPER_ADMIN tidak dibatasi.
 */
export async function requirePropertyAccess(db: DbOrTx, actor: AuthUser, propertyId: number) {
  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
  if (!property) throw new NotFoundError(`Property with ID ${propertyId} not found`);
  if (actor.roleName === 'SUPER_ADMIN') return property;
  const [member] = await db.select({ id: propertyUsers.id }).from(propertyUsers)
    .where(and(eq(propertyUsers.propertyId, propertyId), eq(propertyUsers.userId, actor.id))).limit(1);
  if (!member) throw new ForbiddenError(`You do not have access rights to property ID ${propertyId}`);
  return property;
}

/** ADMIN: anggota properti pemilik room. USER: harus ditugaskan ke room (user_rooms). */
export async function requireRoomAccess(db: DbOrTx, actor: AuthUser, roomId: number, opts: { allowDeleted?: boolean } = {}) {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room || (room.deletedAt && !opts.allowDeleted)) throw new NotFoundError(`Room with ID ${roomId} not found`);
  if (actor.roleName === 'ADMIN' || actor.roleName === 'SUPER_ADMIN') {
    await requirePropertyAccess(db, actor, room.propertyId);
    return room;
  }
  const [assigned] = await db.select({ id: userRooms.id }).from(userRooms)
    .where(and(eq(userRooms.userId, actor.id), eq(userRooms.roomId, roomId))).limit(1);
  if (!assigned) throw new ForbiddenError(`You do not have access rights to manage room ID ${roomId}`);
  return room;
}

/** Versi berinstance dari helper di atas, supaya service/controller tidak memegang handle db. */
export class AccessGuard {
  constructor(private readonly db: DbOrTx) {}
  property(actor: AuthUser, propertyId: number) { return requirePropertyAccess(this.db, actor, propertyId); }
  room(actor: AuthUser, roomId: number, opts: { allowDeleted?: boolean } = {}) { return requireRoomAccess(this.db, actor, roomId, opts); }
}
