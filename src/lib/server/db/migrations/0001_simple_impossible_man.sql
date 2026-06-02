CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`passwordProtected` integer DEFAULT false,
	`passwordHash` text,
	`tier` text DEFAULT 'free',
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `telemetry_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` text NOT NULL,
	`projectId` text NOT NULL,
	`logType` text NOT NULL,
	`payload` text NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`sessionId`) REFERENCES `telemetry_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `telemetry_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`deviceHash` text NOT NULL,
	`browserInfo` text,
	`duration` integer DEFAULT 0,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
