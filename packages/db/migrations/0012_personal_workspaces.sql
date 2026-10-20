ALTER TABLE `organizations` ADD `type` text DEFAULT 'team' NOT NULL;--> statement-breakpoint
CREATE INDEX `org_owner_type_idx` ON `organizations` (`owner_id`,`type`);--> statement-breakpoint
INSERT INTO `organizations` (`id`, `name`, `owner_id`, `type`, `tier`, `created_at`)
SELECT 
    lower(hex(randomblob(16))),
    COALESCE(name, 'Personal') || '''s Workspace',
    id,
    'personal',
    'free',
    unixepoch()
FROM `user`
WHERE id NOT IN (
    SELECT owner_id FROM `organizations` WHERE type = 'personal'
);--> statement-breakpoint
INSERT INTO `organization_memberships` (`id`, `organization_id`, `user_id`, `role`, `created_at`)
SELECT 
    lower(hex(randomblob(16))),
    o.id,
    o.owner_id,
    'owner',
    unixepoch()
FROM `organizations` o
WHERE o.type = 'personal'
  AND NOT EXISTS (
    SELECT 1 FROM `organization_memberships` m
    WHERE m.organization_id = o.id AND m.user_id = o.owner_id
  );--> statement-breakpoint
UPDATE `projects`
SET `organization_id` = (
    SELECT o.id FROM `organizations` o
    WHERE o.owner_id = `projects`.`user_id` AND o.type = 'personal'
    LIMIT 1
)
WHERE `organization_id` IS NULL;
