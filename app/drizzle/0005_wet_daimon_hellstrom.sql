CREATE TABLE `shopping_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source_label` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shopping_list_user_idx` ON `shopping_list` (`user_id`);--> statement-breakpoint
CREATE TABLE `shopping_list_item` (
	`id` text PRIMARY KEY NOT NULL,
	`shopping_list_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`measures_json` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`shopping_list_id`) REFERENCES `shopping_list`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shopping_list_item_list_idx` ON `shopping_list_item` (`shopping_list_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_list_item_position_uq` ON `shopping_list_item` (`shopping_list_id`,`position`);