import { boolean, doublePrecision, integer, jsonb, numeric, text, varchar } from 'drizzle-orm/pg-core';
import { fk, kamomi, pk, tstz } from './_shared.js';
import { users } from './auth.js';

export const subscriptionPlans = kamomi.table('subscription_plans', {
  id: pk(),
  name: varchar('name', { length: 100 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  description: text('description'),
  maxRooms: integer('max_rooms'),
  billingCycle: varchar('billing_cycle'),
  features: jsonb('features'),
  isActive: boolean('is_active').notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  deletedAt: tstz('deleted_at'),
  createdBy: fk('created_by').references(() => users.id),
  updatedBy: fk('updated_by').references(() => users.id),
});

export const userSubscriptions = kamomi.table('user_subscriptions', {
  id: pk(),
  userId: fk('user_id').notNull().references(() => users.id),
  planId: fk('plan_id').notNull().references(() => subscriptionPlans.id),
  status: varchar('status', { length: 20 }).notNull(), // ACTIVE | INACTIVE | EXPIRED
  startDate: tstz('start_date').notNull(),
  endDate: tstz('end_date').notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  deletedAt: tstz('deleted_at'),
  createdBy: fk('created_by').references(() => users.id),
  updatedBy: fk('updated_by').references(() => users.id),
});

export const subscriptionTransactions = kamomi.table('subscription_transactions', {
  id: pk(),
  userSubscriptionId: fk('user_subscription_id').notNull().references(() => userSubscriptions.id),
  amount: doublePrecision('amount').notNull(),
  paymentMethod: varchar('payment_method', { length: 50 }),
  paymentStatus: varchar('payment_status', { length: 20 }).notNull(), // PENDING | SUCCESS | FAILED
  paymentProofUrl: varchar('payment_proof_url', { length: 255 }),
  paidAt: tstz('paid_at').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  createdAt: tstz('created_at').notNull(),
  updatedAt: tstz('updated_at').notNull(),
  deletedAt: tstz('deleted_at'),
  createdBy: fk('created_by').references(() => users.id),
  updatedBy: fk('updated_by').references(() => users.id),
});
