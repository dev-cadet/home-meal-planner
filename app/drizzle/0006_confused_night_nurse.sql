DROP INDEX "account_user_idx";--> statement-breakpoint
DROP INDEX "invite_code_used_at_idx";--> statement-breakpoint
DROP INDEX "meal_name_idx";--> statement-breakpoint
DROP INDEX "meal_ingredient_meal_idx";--> statement-breakpoint
DROP INDEX "meal_ingredient_position_uq";--> statement-breakpoint
DROP INDEX "meal_tag_tag_idx";--> statement-breakpoint
DROP INDEX "plan_name_idx";--> statement-breakpoint
DROP INDEX "plan_item_plan_idx";--> statement-breakpoint
DROP INDEX "plan_item_meal_uq";--> statement-breakpoint
DROP INDEX "plan_item_position_uq";--> statement-breakpoint
DROP INDEX "plan_tag_tag_idx";--> statement-breakpoint
DROP INDEX "plan_tag_name_uq";--> statement-breakpoint
DROP INDEX "schedule_entry_date_idx";--> statement-breakpoint
DROP INDEX "schedule_entry_uq";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "session_user_idx";--> statement-breakpoint
DROP INDEX "shopping_list_user_idx";--> statement-breakpoint
DROP INDEX "shopping_list_item_list_idx";--> statement-breakpoint
DROP INDEX "shopping_list_item_position_uq";--> statement-breakpoint
DROP INDEX "tag_name_uq";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE `shopping_list` ALTER COLUMN "source_label" TO "source_label" text;--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `invite_code_used_at_idx` ON `invite_code` (`used_at`);--> statement-breakpoint
CREATE INDEX `meal_name_idx` ON `meal` (`name`);--> statement-breakpoint
CREATE INDEX `meal_ingredient_meal_idx` ON `meal_ingredient` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meal_ingredient_position_uq` ON `meal_ingredient` (`meal_id`,`position`);--> statement-breakpoint
CREATE INDEX `meal_tag_tag_idx` ON `meal_tag` (`tag_id`);--> statement-breakpoint
CREATE INDEX `plan_name_idx` ON `plan` (`name`);--> statement-breakpoint
CREATE INDEX `plan_item_plan_idx` ON `plan_item` (`plan_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_item_meal_uq` ON `plan_item` (`plan_id`,`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_item_position_uq` ON `plan_item` (`plan_id`,`position`);--> statement-breakpoint
CREATE INDEX `plan_tag_tag_idx` ON `plan_tag` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_tag_name_uq` ON `plan_tag_name` (`name`);--> statement-breakpoint
CREATE INDEX `schedule_entry_date_idx` ON `schedule_entry` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_entry_uq` ON `schedule_entry` (`date`,`slot`,`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_user_idx` ON `shopping_list` (`user_id`);--> statement-breakpoint
CREATE INDEX `shopping_list_item_list_idx` ON `shopping_list_item` (`shopping_list_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_list_item_position_uq` ON `shopping_list_item` (`shopping_list_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `tag_name_uq` ON `tag` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
ALTER TABLE `shopping_list` ADD `pinned` integer DEFAULT false NOT NULL;