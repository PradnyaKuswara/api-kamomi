import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { contactLogs, contacts, facilityGuideLogs, facilityGuides, ruleLogs, rules } from '../../db/schema/index.js';
import { notBlank } from '../../lib/validation.js';
import { ONLY_ADMIN, registerScopedCrud } from './scoped-crud.js';

const iso = (d: Date | null) => d?.toISOString() ?? null;
const max = (n: number, label: string) => z.string().max(n, `${label} tidak boleh lebih dari ${n} karakter`);

/* ----------------------------------- Rules ----------------------------------- */
const ruleBody = z.object({
  title: notBlank('Title is required').pipe(z.string().max(255, 'Title must not exceed 255 characters')),
  description: z.string().nullish(),
  category: z.string().max(50, 'Category must not exceed 50 characters').nullish(),
  sequence: z.number().int().nullish(),
  isActive: z.boolean().nullish(),
});

/* ------------------------------- Facility guides ------------------------------ */
const guideBody = z.object({
  name: notBlank('Name is required').pipe(z.string().max(100, 'Name must not exceed 100 characters')),
  icon: z.string().max(50, 'Icon must not exceed 50 characters').nullish(),
  title: notBlank('Title is required').pipe(z.string().max(150, 'Title must not exceed 150 characters')),
  steps: z.array(z.string(), { error: 'Steps is required' }),
});

/* --------------------------------- Contacts ---------------------------------- */
const contactBody = z.object({
  name: notBlank('Nama kontak tidak boleh kosong').pipe(max(100, 'Nama kontak')),
  role: notBlank('Role/jabatan kontak tidak boleh kosong').pipe(max(100, 'Role/jabatan')),
  contactType: notBlank('Tipe kontak tidak boleh kosong').pipe(max(50, 'Tipe kontak')),
  contactValue: notBlank('Nilai kontak tidak boleh kosong').pipe(max(255, 'Nilai kontak')),
  actionText: max(100, 'Teks aksi').nullish(),
  color: max(150, 'Warna').nullish(),
  icon: max(50, 'Icon').nullish(),
  link: max(255, 'Link').nullish(),
});
type ContactBody = z.infer<typeof contactBody>;

const DEFAULTS: Record<string, { action: string; color: string; icon: string }> = {
  WHATSAPP: { action: 'Chat WhatsApp', color: 'emerald', icon: 'MessageCircle' },
  EMAIL: { action: 'Kirim Email', color: 'blue', icon: 'Mail' },
  PHONE: { action: 'Hubungi Telepon', color: 'cyan', icon: 'Phone' },
};
const defaults = (type: string) => DEFAULTS[type.toUpperCase()] ?? { action: 'Hubungi', color: 'slate', icon: 'Info' };

function deriveLink(type: string, value: string): string {
  const v = value.trim();
  switch (type.toUpperCase()) {
    case 'WHATSAPP': {
      let n = v.replace(/[^0-9]/g, '');
      if (n.startsWith('0')) n = '62' + n.slice(1);
      return `https://wa.me/${n}`;
    }
    case 'EMAIL': return `mailto:${v}`;
    case 'PHONE': return `tel:${v}`;
    default: return v;
  }
}
const filled = (v: string | null | undefined, fallback: string) => (v && v.trim() ? v : fallback);
const contactFields = (b: ContactBody) => {
  const d = defaults(b.contactType);
  return {
    name: b.name, role: b.role, contactType: b.contactType.toUpperCase(), contactValue: b.contactValue,
    actionText: filled(b.actionText, d.action), color: filled(b.color, d.color), icon: filled(b.icon, d.icon),
    link: filled(b.link, deriveLink(b.contactType, b.contactValue)),
  };
};

export async function contentRoutes(app: FastifyInstance) {
  registerScopedCrud(app, {
    path: 'rules', label: 'master rule', table: rules, body: ruleBody,
    notFound: (id) => `Rule with ID ${id} not found`,
    messages: { list: 'Successfully retrieved master rules', create: 'Successfully created master rule', update: 'Successfully updated master rule', delete: 'Successfully deleted master rule' },
    deleteRoles: ONLY_ADMIN,
    toDto: (x) => ({ id: x.id, propertyId: x.propertyId, title: x.title, description: x.description, category: x.category, sequence: x.sequence, isActive: x.isActive, createdAt: x.createdAt }),
    toInsert: (b) => ({ title: b.title, description: b.description ?? null, category: b.category ?? 'Mandatory', sequence: b.sequence ?? 0, isActive: b.isActive ?? true }),
    toUpdate: (b) => ({ title: b.title, description: b.description ?? null, ...(b.category != null && { category: b.category }), ...(b.sequence != null && { sequence: b.sequence }), ...(b.isActive != null && { isActive: b.isActive }) }),
    snapshot: (x) => ({ id: x.id, propertyId: x.propertyId, title: x.title, description: x.description, sequence: x.sequence, category: x.category, isActive: x.isActive, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt), deletedAt: iso(x.deletedAt) }),
    writeLog: (db, ruleId, by, action, oldData, newData) => db.insert(ruleLogs).values({ ruleId, action, oldData, newData, createdAt: new Date(), createdBy: by }),
  });

  registerScopedCrud(app, {
    path: 'facility-guides', label: 'facility guide', table: facilityGuides, body: guideBody,
    notFound: (id) => `Facility Guide with ID ${id} not found`,
    messages: { list: 'Successfully retrieved facility guides', create: 'Successfully created facility guide', update: 'Successfully updated facility guide', delete: 'Successfully deleted facility guide' },
    toDto: (x) => ({ id: x.id, propertyId: x.propertyId, name: x.name, icon: x.icon, title: x.title, steps: x.steps, createdAt: x.createdAt }),
    toInsert: (b) => ({ name: b.name, icon: b.icon ?? 'Wind', title: b.title, steps: b.steps }),
    toUpdate: (b) => ({ name: b.name, ...(b.icon != null && { icon: b.icon }), title: b.title, steps: b.steps }),
    snapshot: (x) => ({ id: x.id, propertyId: x.propertyId, name: x.name, icon: x.icon, title: x.title, steps: x.steps, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt), deletedAt: iso(x.deletedAt) }),
    writeLog: (db, guideId, by, action, oldData, newData) => db.insert(facilityGuideLogs).values({ guideId, action, oldData, newData, createdAt: new Date(), createdBy: by }),
  });

  registerScopedCrud(app, {
    path: 'contacts', label: 'contact', table: contacts, body: contactBody,
    notFound: (id) => `Contact with ID ${id} not found`,
    messages: { list: 'Successfully retrieved contacts', create: 'Successfully created contact', update: 'Successfully updated contact', delete: 'Successfully deleted contact' },
    toDto: (x) => ({ id: x.id, propertyId: x.propertyId, name: x.name, role: x.role, contactType: x.contactType, contactValue: x.contactValue, actionText: x.actionText, color: x.color, icon: x.icon, link: x.link, createdAt: x.createdAt }),
    toInsert: contactFields,
    toUpdate: contactFields,
    snapshot: (x) => ({ id: x.id, propertyId: x.propertyId, name: x.name, role: x.role, contactType: x.contactType, contactValue: x.contactValue, actionText: x.actionText, color: x.color, icon: x.icon, link: x.link, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt), deletedAt: iso(x.deletedAt) }),
    writeLog: (db, contactId, by, action, oldData, newData) => db.insert(contactLogs).values({ contactId, action, oldData, newData, createdAt: new Date(), createdBy: by }),
  });
}
