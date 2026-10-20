PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`type` text DEFAULT 'team' NOT NULL,
	`creem_subscription_id` text,
	`creem_customer_id` text,
	`subscription_status` text DEFAULT 'active',
	`tier` text DEFAULT 'free',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_organizations`("id", "name", "owner_id", "type", "creem_subscription_id", "creem_customer_id", "subscription_status", "tier", "created_at") SELECT "id", "name", "owner_id", "type", "creem_subscription_id", "creem_customer_id", "subscription_status", "tier", "created_at" FROM `organizations`;--> statement-breakpoint
DROP TABLE `organizations`;--> statement-breakpoint
ALTER TABLE `__new_organizations` RENAME TO `organizations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `org_owner_type_idx` ON `organizations` (`owner_id`,`type`);--> statement-breakpoint
CREATE INDEX `org_creem_sub_idx` ON `organizations` (`creem_subscription_id`);--> statement-breakpoint
DROP INDEX `telemetry_sessions_gameBuildId_idx`;--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `r2_log_path` text;--> statement-breakpoint
CREATE INDEX `telemetry_sessions_buildId_idx` ON `telemetry_sessions` (`game_build_id`);--> statement-breakpoint
CREATE INDEX `telemetry_sessions_createdAt_idx` ON `telemetry_sessions` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_game_builds` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`version_string` text DEFAULT '1.0.0' NOT NULL,
	`r2_folder_path` text NOT NULL,
	`total_size_bytes` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_game_builds`("id", "project_id", "version_string", "r2_folder_path", "total_size_bytes", "is_active", "uploaded_at") SELECT "id", "project_id", "version_string", "r2_folder_path", "total_size_bytes", "is_active", "uploaded_at" FROM `game_builds`;--> statement-breakpoint
DROP TABLE `game_builds`;--> statement-breakpoint
ALTER TABLE `__new_game_builds` RENAME TO `game_builds`;--> statement-breakpoint
CREATE INDEX `game_builds_projectId_idx` ON `game_builds` (`project_id`);--> statement-breakpoint
CREATE INDEX `game_builds_project_active_idx` ON `game_builds` (`project_id`,`is_active`);--> statement-breakpoint
CREATE TABLE `__new_project_access_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`max_uses` integer DEFAULT 20,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_project_access_keys`("id", "project_id", "name", "code", "max_uses", "used_count", "expires_at", "is_active", "created_at") SELECT "id", "project_id", "name", "code", "max_uses", "used_count", "expires_at", "is_active", "created_at" FROM `project_access_keys`;--> statement-breakpoint
DROP TABLE `project_access_keys`;--> statement-breakpoint
ALTER TABLE `__new_project_access_keys` RENAME TO `project_access_keys`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_access_keys_code_unique` ON `project_access_keys` (`code`);--> statement-breakpoint
CREATE INDEX `proj_keys_projectId_idx` ON `project_access_keys` (`project_id`);--> statement-breakpoint
CREATE INDEX `proj_keys_code_idx` ON `project_access_keys` (`code`);--> statement-breakpoint
ALTER TABLE `processed_webhooks` ADD `event_type` text NOT NULL;--> statement-breakpoint
ALTER TABLE `profile` ADD `updated_at` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `profile_user_id_unique` ON `profile` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_projectId_idx` ON `payments` (`project_id`);--> statement-breakpoint
CREATE INDEX `payments_userId_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_quotas_projectId_idx` ON `project_quotas` (`project_id`);--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `password_protected`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `password_hash`;