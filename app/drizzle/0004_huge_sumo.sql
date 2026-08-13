CREATE TABLE `plan_tag_name` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_tag_name_uq` ON `plan_tag_name` (`name`);--> statement-breakpoint
-- Splitting one shared tag vocabulary into two independent ones. Every tag
-- already attached to a plan is copied into the new plan-only table, keeping
-- the same id, so `plan_tag.tag_id` below needs no remapping — it already
-- points at valid rows the moment this insert has run.
INSERT INTO `plan_tag_name` (`id`, `name`, `created_at`)
SELECT DISTINCT t.id, t.name, t.created_at
FROM `tag` t
WHERE t.id IN (SELECT tag_id FROM `plan_tag`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_plan_tag` (
	`plan_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`plan_id`, `tag_id`),
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `plan_tag_name`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_plan_tag`("plan_id", "tag_id", "created_at") SELECT "plan_id", "tag_id", "created_at" FROM `plan_tag`;--> statement-breakpoint
DROP TABLE `plan_tag`;--> statement-breakpoint
ALTER TABLE `__new_plan_tag` RENAME TO `plan_tag`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `plan_tag_tag_idx` ON `plan_tag` (`tag_id`);--> statement-breakpoint
-- A tag that only ever existed for the plan side has nothing left to mean
-- in the now meal-only `tag` table.
DELETE FROM `tag` WHERE id NOT IN (SELECT DISTINCT tag_id FROM `meal_tag`);