PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
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
INSERT INTO `__new_payments`("id", "project_id", "user_id", "creem_checkout_id", "creem_order_id", "creem_customer_id", "amount", "currency", "status", "created_at") SELECT "id", "project_id", "user_id", "creem_checkout_id", "creem_order_id", "creem_customer_id", "amount", "currency", "status", "created_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
ALTER TABLE `__new_payments` RENAME TO `payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_creem_checkout_id_unique` ON `payments` (`creem_checkout_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_creem_order_id_unique` ON `payments` (`creem_order_id`);