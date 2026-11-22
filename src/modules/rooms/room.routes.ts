import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AccessGuard } from '../properties/access.js';
import { SubscriptionPolicy } from '../subscriptions/subscription-policy.js';
import { RoomController } from './room.controller.js';
import { RoomRepository } from './room.repository.js';
import { RoomService } from './room.service.js';

const str = (max: number, label: string) => z.string().max(max, `${label} must not exceed ${max} characters`).nullish();
const ids = z.array(z.number().int()).nullish();

const qr = z.object({
  customTitle: str(100, 'Custom title'), customInstruction: str(255, 'Custom instruction'),
  showLogo: z.boolean().nullish(), cardColor: str(50, 'Card color'), template: str(50, 'Template'), labelRoom: str(100, 'Label room'),
});
const roomBody = z.object({
  roomNumber: str(50, 'Room number'), wifiSsid: str(50, 'WiFi SSID'), wifiPassword: str(50, 'WiFi password'),
  ruleIds: ids, assignedUserIds: ids, isActive: z.boolean().nullish(), qrDesign: qr.nullish(),
});
const pid = z.object({ propertyId: z.coerce.number().int().positive() });
const pidRid = pid.extend({ roomId: z.coerce.number().int().positive() });

export async function roomRoutes(app: FastifyInstance) {
  const c = new RoomController(app, new RoomService(new RoomRepository(app.db), new AccessGuard(app.db), new SubscriptionPolicy(app.db)));
  const r = app.withTypeProvider<ZodTypeProvider>();
  const base = '/api/properties/:propertyId/rooms';

  r.get(base, { schema: { params: pid } }, c.list);
  // Didaftarkan sebelum '/:roomId' agar '/logs' tidak ditangkap sebagai roomId.
  r.get(`${base}/logs`, { schema: { params: pid } }, c.logsByProperty);
  r.get(`${base}/:roomId`, { schema: { params: pidRid } }, c.get);
  r.post(base, { schema: { params: pid, body: roomBody } }, c.create);
  r.put(`${base}/:roomId`, { schema: { params: pidRid, body: roomBody } }, c.update);
  r.delete(`${base}/:roomId`, { schema: { params: pidRid } }, c.remove);
  r.get(`${base}/:roomId/logs`, { schema: { params: pidRid } }, c.logsByRoom);
}
