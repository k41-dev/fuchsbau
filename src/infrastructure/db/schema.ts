import { sql } from 'drizzle-orm';
import {
	customType,
	pgTable,
	serial,
	text,
	timestamp,
	integer,
	boolean,
	uniqueIndex,
	date
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType() {
		return 'bytea';
	}
});

// ============================================
// Better Auth Tables (required)
// ============================================
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  accountRole: text('account_role').notNull().default('worker'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Application Tables
// ============================================
export const project = pgTable('project', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address'),
  color: text('color').default('#3b82f6'),
  backgroundImageData: bytea('background_image_data'),
  backgroundImageContentType: text('background_image_content_type'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const timeEntry = pgTable('time_entry', {
  id: serial('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').references(() => project.id, { onDelete: 'set null' }),
  roleId: integer('role_id').references(() => role.id, { onDelete: 'set null' }),
  description: text('description'),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // in seconds
  isRunning: boolean('is_running').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ============================================
// Roles & Project Membership (NEW)
// ============================================

export const role = pgTable('role', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => project.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const timeEntryCorrection = pgTable('time_entry_correction', {
  id: serial('id').primaryKey(),
  timeEntryId: integer('time_entry_id')
    .notNull()
    .references(() => timeEntry.id, { onDelete: 'cascade' }),
  correctedByUserId: text('corrected_by_user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  previousStartTime: timestamp('previous_start_time').notNull(),
  previousEndTime: timestamp('previous_end_time'),
  previousDuration: integer('previous_duration'),
  newStartTime: timestamp('new_start_time').notNull(),
  newEndTime: timestamp('new_end_time'),
  newDuration: integer('new_duration'),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const breakPeriod = pgTable('break_period', {
  id: serial('id').primaryKey(),
  timeEntryId: integer('time_entry_id')
    .notNull()
    .references(() => timeEntry.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // in seconds
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const absence = pgTable(
  'absence',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    type: text('type').notNull().default('sick'),
    status: text('status').notNull().default('pending'),
    requestGroupId: text('request_group_id').notNull(),
    note: text('note'),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('absence_user_date_active_unique')
      .on(table.userId, table.date)
      .where(sql`status != 'rejected'`)
  ]
);

export const projectMember = pgTable(
  'project_member',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('project_member_project_user_unique').on(table.projectId, table.userId)]
);

export const workerInvite = pgTable(
  'worker_invite',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    invitedByUserId: text('invited_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    acceptedByUserId: text('accepted_by_user_id').references(() => user.id, {
      onDelete: 'set null'
    }),
    acceptedAt: timestamp('accepted_at'),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('worker_invite_project_email_pending_unique')
      .on(table.projectId, table.email)
      .where(sql`status = 'pending'`)
  ]
);