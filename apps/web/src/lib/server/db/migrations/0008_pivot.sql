CREATE TABLE `custom_developer_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_name` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `telemetry_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `log_project_event_idx` ON `custom_developer_logs` (`project_id`,`event_name`);--> statement-breakpoint
CREATE INDEX `log_session_idx` ON `custom_developer_logs` (`session_id`);--> statement-breakpoint
DROP TABLE `bug_reports`;--> statement-breakpoint
DROP TABLE `gameplay_events`;--> statement-breakpoint
DROP TABLE `telemetry_logs`;