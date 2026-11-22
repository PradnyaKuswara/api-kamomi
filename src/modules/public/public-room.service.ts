import { BadRequestError, NotFoundError } from '../../errors/app-error.js';
import { decryptId } from '../../lib/hash-id.js';
import type { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import type { PublicRoomRepository } from './public-room.repository.js';

export class PublicRoomService {
  constructor(private readonly repo: PublicRoomRepository, private readonly policy: SubscriptionPolicy) {}

  async getByCode(code: string) {
    const roomId = decryptId(code);
    if (roomId === null) throw new BadRequestError('Invalid room code format', 'Invalid room code format');
    const row = await this.repo.findRoomWithProperty(roomId);
    if (!row) throw new NotFoundError('Room not found');
    if (row.room.isActive === false) throw new NotFoundError('Room is inactive');
    const { room, property } = row;

    if (await this.policy.isSuspended(property.userId)) {
      return { roomNumber: room.roomNumber, wifiSsid: null, wifiPassword: null, propertyName: property.name,
        qrDesign: null, rules: null, contacts: null, facilityGuides: null, isSuspended: true };
    }

    const [q, ruleRows, contactRows, guideRows] = await Promise.all([
      this.repo.findQr(room.id), this.repo.findRules(room.id),
      this.repo.findContacts(property.id), this.repo.findGuides(property.id),
    ]);

    return {
      roomNumber: room.roomNumber, wifiSsid: room.wifiSsid, wifiPassword: room.wifiPassword, propertyName: property.name,
      qrDesign: {
        customTitle: q?.customTitle ?? 'Welcome', customInstruction: q?.customInstruction ?? 'Scan QR for Room & Wi-Fi Info',
        showLogo: q?.showLogo ?? true, cardColor: q?.cardColor ?? 'cyan', template: q?.template ?? 'modern', labelRoom: q?.labelRoom ?? 'NOMOR KAMAR',
      },
      rules: ruleRows.map((r) => ({ id: r.id, propertyId: r.propertyId, title: r.title, description: r.description,
        category: r.category, sequence: r.sequence, isActive: r.isActive, createdAt: r.createdAt })),
      contacts: contactRows.map((c) => ({ id: c.id, propertyId: c.propertyId, name: c.name, role: c.role, contactType: c.contactType,
        contactValue: c.contactValue, actionText: c.actionText, color: c.color, icon: c.icon, link: c.link, createdAt: c.createdAt })),
      facilityGuides: guideRows.map((g) => ({ id: g.id, propertyId: g.propertyId, name: g.name, icon: g.icon, title: g.title, steps: g.steps, createdAt: g.createdAt })),
      isSuspended: false,
    };
  }
}
