import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const profiles=sqliteTable('profiles',{userId:text('user_id').primaryKey(),data:text('data').notNull(),updatedAt:text('updated_at').notNull()});
export const entries=sqliteTable('entries',{id:text('id').primaryKey(),userId:text('user_id').notNull(),date:text('date').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull(),deletedAt:text('deleted_at')},t=>[index('idx_entries_user_date').on(t.userId,t.date)]);
export const messages=sqliteTable('messages',{id:text('id').primaryKey(),userId:text('user_id').notNull(),role:text('role').notNull(),text:text('text').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_messages_user_created').on(t.userId,t.createdAt)]);

export const advice = sqliteTable('advice', {userId:text('user_id').primaryKey(),data:text('data').notNull()});
