CREATE TABLE `bug_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`project_id` text NOT NULL,
	`user_comment` text NOT NULL,
	`screenshot_r2_key` text,
	`logs_snapshot` text,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `telemetry_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_builds` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version_string` text DEFAULT '1.0.0' NOT NULL,
	`r2_folder_path` text NOT NULL,
	`total_size_bytes` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`creem_checkout_id` text,
	`creem_order_id` text,
	`creem_customer_id` text,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'gbp' NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_creem_checkout_id_unique` ON `payments` (`creem_checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_creem_order_id_unique` ON `payments` (`creem_order_id`);--> statement-breakpoint
CREATE TABLE `processed_webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_quotas` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`monthly_write_count` integer DEFAULT 0 NOT NULL,
	`max_write_limit` integer DEFAULT 100000 NOT NULL,
	`storage_bytes_used` integer DEFAULT 0 NOT NULL,
	`last_reset_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`password_protected` integer DEFAULT false,
	`password_hash` text,
	`tier` text DEFAULT 'free',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "user_id", "name", "password_protected", "password_hash", "tier", "created_at") SELECT "id", "user_id", "name", "password_protected", "password_hash", "tier", "created_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_telemetry_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`project_id` text NOT NULL,
	`log_type` text NOT NULL,
	`payload` text NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `telemetry_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_telemetry_logs`("id", "session_id", "project_id", "log_type", "payload", "timestamp") SELECT "id", "session_id", "project_id", "log_type", "payload", "timestamp" FROM `telemetry_logs`;--> statement-breakpoint
DROP TABLE `telemetry_logs`;--> statement-breakpoint
ALTER TABLE `__new_telemetry_logs` RENAME TO `telemetry_logs`;--> statement-breakpoint
CREATE TABLE `__new_telemetry_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`device_hash` text NOT NULL,
	`browser_info` text,
	`duration` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_telemetry_sessions`("id", "project_id", "device_hash", "browser_info", "duration", "created_at") SELECT "id", "project_id", "device_hash", "browser_info", "duration", "created_at" FROM `telemetry_sessions`;--> statement-breakpoint
DROP TABLE `telemetry_sessions`;--> statement-breakpoint
ALTER TABLE `__new_telemetry_sessions` RENAME TO `telemetry_sessions`;