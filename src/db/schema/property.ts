import { bigint, boolean, integer, jsonb, primaryKey, text, unique, varchar } from 'drizzle-orm/pg-core';
import { auditData, fk, kamomi, pk, tstz } from './_shared.js';
import { users } from './auth.js';

const audit = () => ({
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  deletedAt: tstz('deleted_at'),
  createdBy: fk('created_by').references(() => users.id),
  updatedBy: fk('updated_by').references(() => users.id),
});
const logCols = () => ({
  action: varchar('action', { length: 50 }).notNull(),
  ...auditData(),
  createdAt: tstz('created_at').notNull(),
  createdBy: fk('created_by').references(() => users.id),
});

export const properties = kamomi.table('properties', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  propertyType: varchar('property_type', { length: 20 }).notNull(), // HOUSE | APARTMENT | OFFICE
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  province: varchar('province', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 10 }),
  isActive: boolean('is_active').notNull(),
  ...audit(),
});

export const propertyUsers = kamomi.table('property_users', {
  id: pk(),
  propertyId: fk('property_id').notNull().references(() => properties.id),
  userId: fk('user_id').notNull().references(() => users.id),
  createdAt: tstz('created_at').notNull(),
}, (t) => [unique('uq_property_user').on(t.propertyId, t.userId)]);

export const propertyLogs = kamomi.table('property_logs', {
  id: pk(),
  propertyId: fk('property_id').notNull().references(() => properties.id),
  ...logCols(),
});

export const rooms = kamomi.table('rooms', {
  id: pk(),
  propertyId: fk('property_id').notNull().references(() => properties.id),
  roomNumber: varchar('room_number', { length: 50 }),
  wifiSsid: varchar('wifi_ssid', { length: 50 }),
  wifiPassword: varchar('wifi_password', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  ...audit(),
});

export const roomLogs = kamomi.table('room_logs', {
  id: pk(),
  roomId: fk('room_id').notNull().references(() => rooms.id),
  ...logCols(),
});

export const qrDesigns = kamomi.table('qr_designs', {
  id: pk(),
  roomId: fk('room_id').notNull().references(() => rooms.id),
  customTitle: varchar('custom_title', { length: 100 }).notNull(),
  customInstruction: varchar('custom_instruction', { length: 255 }).notNull(),
  showLogo: boolean('show_logo').notNull(),
  cardColor: varchar('card_color', { length: 50 }),
  template: varchar('template', { length: 50 }),
  labelRoom: varchar('label_room', { length: 100 }),
  isActive: boolean('is_active').notNull(),
  ...audit(),
});

export const userRooms = kamomi.table('user_rooms', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  roomId: fk('room_id').notNull().references(() => rooms.id),
  createdAt: tstz('created_at'),
  createdBy: fk('created_by').references(() => users.id),
}, (t) => [unique('uq_user_room').on(t.userId, t.roomId)]);

export const rules = kamomi.table('rules', {
  id: pk(),
  propertyId: fk('property_id').notNull().references(() => properties.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  sequence: integer('sequence').notNull(),
  category: varchar('category', { length: 50 }).notNull(), // Wajib | Larangan | Ketentuan
  isActive: boolean('is_active').notNull(),
  ...audit(),
});

export const roomRules = kamomi.table('room_rules', {
  roomId: bigint('room_id', { mode: 'number' }).notNull().references(() => rooms.id),
  ruleId: bigint('rule_id', { mode: 'number' }).notNull().references(() => rules.id),
}, (t) => [primaryKey({ columns: [t.roomId, t.ruleId] })]);

export const ruleLogs = kamomi.table('rule_logs', {
  id: pk(),
  ruleId: fk('rule_id').notNull().references(() => rules.id),
  ...logCols(),
});

export const facilityGuides = kamomi.table('facility_guides', {
  id: pk(),
  propertyId: fk('property_id').notNull().references(() => properties.id),
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }).notNull(),
  title: varchar('title', { length: 150 }).notNull(),
  steps: jsonb('steps').$type<string[]>().notNull(),
  ...audit(),
});

export const facilityGuideLogs = kamomi.table('facility_guide_logs', {
  id: pk(),
  guideId: fk('guide_id').notNull().references(() => facilityGuides.id),
  ...logCols(),
});

export const faqs = kamomi.table('faqs', {
  id: pk(),
  propertyId: fk('property_id').references(() => properties.id),
  category: varchar('category', { length: 100 }).notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sequence: integer('sequence').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  createdBy: fk('created_by').references(() => users.id),
  updatedBy: fk('updated_by').references(() => users.id),
});

export const contacts = kamomi.table('contacts', {
  id: pk(),
  propertyId: fk('property_id').notNull().references(() => properties.id),
  role: varchar('role', { length: 100 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  contactType: varchar('contact_type', { length: 50 }).notNull(), // WHATSAPP | EMAIL | PHONE
  contactValue: varchar('contact_value', { length: 255 }).notNull(),
  actionText: varchar('action_text', { length: 100 }).notNull(),
  color: varchar('color', { length: 150 }),
  icon: varchar('icon', { length: 50 }),
  link: varchar('link', { length: 255 }).notNull(),
  ...audit(),
});

export const contactLogs = kamomi.table('contact_logs', {
  id: pk(),
  contactId: fk('contact_id').notNull().references(() => contacts.id),
  ...logCols(),
});

export const complaints = kamomi.table('complaints', {
  id: pk(),
  roomId: fk('room_id').notNull().references(() => rooms.id),
  category: varchar('category', { length: 50 }).notNull(),
  description: text('description').notNull(),
  guestName: varchar('guest_name', { length: 100 }),
  guestContact: varchar('guest_contact', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: text('user_agent'),
  status: varchar('status', { length: 30 }).notNull(), // PENDING | IN_PROGRESS | RESOLVED | REJECTED
  responseNote: text('response_note'),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  deletedAt: tstz('deleted_at'),
});

export const notifications = kamomi.table('notifications', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  propertyId: fk('property_id').references(() => properties.id),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  referenceId: bigint('reference_id', { mode: 'number' }),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: tstz('created_at').notNull(),
  deletedAt: tstz('deleted_at'),
});
