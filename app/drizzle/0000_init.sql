CREATE TABLE `invite_code` (
	`code` text PRIMARY KEY NOT NULL,
	`created_by_id` text,
	`used_by_id` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invite_code_used_at_idx` ON `invite_code` (`used_at`);--> statement-breakpoint
CREATE TABLE `meal` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`servings` integer,
	`prep_mins` integer,
	`cook_mins` integer,
	`image_hash` text,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "meal_servings_positive" CHECK("meal"."servings" IS NULL OR "meal"."servings" > 0)
);
--> statement-breakpoint
CREATE INDEX `meal_name_idx` ON `meal` (`name`);--> statement-breakpoint
CREATE TABLE `meal_image` (
	`meal_id` text PRIMARY KEY NOT NULL,
	`full` blob NOT NULL,
	`thumb` blob NOT NULL,
	`mime` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meal_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`position` integer NOT NULL,
	`quantity` real NOT NULL,
	`unit` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "meal_ingredient_quantity_positive" CHECK("meal_ingredient"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `meal_ingredient_meal_idx` ON `meal_ingredient` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meal_ingredient_position_uq` ON `meal_ingredient` (`meal_id`,`position`);--> statement-breakpoint
CREATE TABLE `plan` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_name_idx` ON `plan` (`name`);--> statement-breakpoint
CREATE TABLE `plan_item` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`meal_id` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plan_item_plan_idx` ON `plan_item` (`plan_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_item_meal_uq` ON `plan_item` (`plan_id`,`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_item_position_uq` ON `plan_item` (`plan_id`,`position`);--> statement-breakpoint
CREATE TABLE `schedule_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`meal_id` text NOT NULL,
	`created_by_id` text,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "schedule_entry_date_format" CHECK("schedule_entry"."date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `schedule_entry_date_idx` ON `schedule_entry` (`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `schedule_entry_uq` ON `schedule_entry` (`date`,`slot`,`meal_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);