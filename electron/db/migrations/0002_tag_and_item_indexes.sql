CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`collection_id` text NOT NULL,
	`column_size` text DEFAULT 'medium' NOT NULL,
	`idx` integer,
	`description` text,
	`color_json` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tag_collection_id_idx` ON `tag` (`collection_id`);--> statement-breakpoint
CREATE INDEX `tag_collection_idx_order` ON `tag` (`collection_id`,`idx`);--> statement-breakpoint
CREATE INDEX `library_item_fetched_at_idx` ON `library_item` (`fetched_at`);