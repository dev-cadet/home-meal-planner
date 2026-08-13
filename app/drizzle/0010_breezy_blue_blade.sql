CREATE TABLE `meal_step` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_step_meal_idx` ON `meal_step` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meal_step_position_uq` ON `meal_step` (`meal_id`,`position`);--> statement-breakpoint
INSERT INTO `meal_step` (`id`, `meal_id`, `position`, `text`)
SELECT lower(hex(randomblob(16))), `id`, 0, `notes` FROM `meal` WHERE `notes` IS NOT NULL AND trim(`notes`) != '';--> statement-breakpoint
ALTER TABLE `meal` DROP COLUMN `notes`;