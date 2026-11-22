import { boolean, integer, text, varchar } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { auditData, fk, kamomi, pk, tstz } from './_shared.js';

export const roles = kamomi.table('roles', {
  id: pk(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: tstz('created_at'),
  updatedAt: tstz('updated_at'),
});

export const users = kamomi.table('users', {
  id: pk(),
  roleId: fk('role_id').notNull().references(() => roles.id),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  oauthProvider: varchar('oauth_provider', { length: 50 }).default('LOCAL'),
  oauthId: varchar('oauth_id', { length: 100 }).unique(),
  isActive: boolean('is_active').notNull().default(false),
  isEmailVerified: boolean('is_email_verified').notNull().default(false),
  emailVerificationCode: varchar('email_verification_code', { length: 6 }),
  emailVerificationSentAt: tstz('email_verification_sent_at'),
  passwordResetToken: varchar('password_reset_token', { length: 100 }),
  passwordResetExpiresAt: tstz('password_reset_expires_at'),
  createdAt: tstz('created_at'),
  updatedAt: tstz('updated_at'),
  deletedAt: tstz('deleted_at'),
  createdBy: fk('created_by').references((): AnyPgColumn => users.id),
  updatedBy: fk('updated_by').references((): AnyPgColumn => users.id),
});

export const userLogs = kamomi.table('user_logs', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(),
  ...auditData(),
  createdAt: tstz('created_at').notNull(),
  createdBy: fk('created_by').references(() => users.id),
});

export const userActivities = kamomi.table('user_activities', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  activityType: varchar('activity_type', { length: 50 }).notNull(), // LOGIN | LOGOUT | SESSION_EXPIRED
  loginAt: tstz('login_at'),
  logoutAt: tstz('logout_at'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  sessionToken: varchar('session_token', { length: 255 }),
});

export const menuSections = kamomi.table('menu_sections', {
  id: pk(),
  title: varchar('title', { length: 100 }).notNull().unique(),
  orderNo: integer('order_no').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: tstz('created_at'),
  updatedAt: tstz('updated_at'),
});

export const menus = kamomi.table('menus', {
  id: pk(),
  title: varchar('title', { length: 100 }).notNull(),
  url: varchar('url', { length: 255 }),
  icon: varchar('icon', { length: 100 }),
  orderNo: integer('order_no').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  parentId: fk('parent_id').references((): AnyPgColumn => menus.id),
  sectionId: fk('section_id').references(() => menuSections.id),
  createdAt: tstz('created_at'),
  updatedAt: tstz('updated_at'),
});

export const roleMenus = kamomi.table('role_menus', {
  id: pk(),
  roleId: fk('role_id').notNull().references(() => roles.id),
  menuId: fk('menu_id').notNull().references(() => menus.id),
});

export const userMenuOverrides = kamomi.table('user_menu_overrides', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  menuId: fk('menu_id').notNull().references(() => menus.id),
  isAllowed: boolean('is_allowed').notNull(),
});
