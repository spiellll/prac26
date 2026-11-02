CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_entries_user_date` ON `entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_user_created` ON `messages` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
