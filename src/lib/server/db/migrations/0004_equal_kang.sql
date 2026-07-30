ALTER TABLE `bug_reports` ADD `status` text DEFAULT 'open' NOT NULL;--> statement-breakpoint
CREATE INDEX `bug_reports_sessionId_idx` ON `bug_reports` (`session_id`);--> statement-breakpoint
CREATE INDEX `bug_reports_projectId_idx` ON `bug_reports` (`project_id`);--> statement-breakpoint
ALTER TABLE `telemetry_sessions` ADD `game_build_id` text REFERENCES game_builds(id);--> statement-breakpoint
CREATE INDEX `telemetry_sessions_projectId_idx` ON `telemetry_sessions` (`project_id`);--> statement-breakpoint
CREATE INDEX `telemetry_sessions_gameBuildId_idx` ON `telemetry_sessions` (`game_build_id`);--> statement-breakpoint
CREATE INDEX `game_builds_projectId_idx` ON `game_builds` (`project_id`);--> statement-breakpoint
CREATE INDEX `projects_userId_idx` ON `projects` (`user_id`);--> statement-breakpoint
CREATE INDEX `telemetry_logs_sessionId_idx` ON `telemetry_logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `telemetry_logs_projectId_idx` ON `telemetry_logs` (`project_id`);