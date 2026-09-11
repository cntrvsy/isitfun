CREATE TABLE `gameplay_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`project_id` text NOT NULL,
	`event_name` text NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`timestamp` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `telemetry_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gameplay_events_projectId_idx` ON `gameplay_events` (`project_id`);--> statement-breakpoint
CREATE INDEX `gameplay_events_eventName_idx` ON `gameplay_events` (`event_name`);