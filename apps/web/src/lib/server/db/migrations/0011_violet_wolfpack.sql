CREATE TABLE `project_access_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`max_uses` integer DEFAULT 20 NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_access_keys_code_unique` ON `project_access_keys` (`code`);--> statement-breakpoint
CREATE INDEX `proj_keys_projectId_idx` ON `project_access_keys` (`project_id`);--> statement-breakpoint
CREATE INDEX `proj_keys_code_idx` ON `project_access_keys` (`code`);--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `sentiment` text;--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `avg_fps` integer;--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `user_comment` text;--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `gpu_renderer` text;