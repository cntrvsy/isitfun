DROP TABLE `custom_developer_logs`;--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `log_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `has_crashed` integer DEFAULT false NOT NULL;