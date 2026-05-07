CREATE TABLE `library_item_order` (
	`scope_key` text NOT NULL,
	`library_item_id` text NOT NULL,
	`sort_index` integer NOT NULL,
	PRIMARY KEY(`scope_key`, `library_item_id`),
	FOREIGN KEY (`library_item_id`) REFERENCES `library_item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `library_item_order_scope_sort_idx` ON `library_item_order` (`scope_key`,`sort_index`);--> statement-breakpoint
CREATE TABLE `collection_order` (
	`bucket_key` text DEFAULT 'sidebar' NOT NULL,
	`collection_id` text NOT NULL,
	`sort_index` integer NOT NULL,
	PRIMARY KEY(`bucket_key`, `collection_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `collection_order_bucket_sort_idx` ON `collection_order` (`bucket_key`,`sort_index`);--> statement-breakpoint
CREATE TABLE `favorite` (
	`id` text PRIMARY KEY NOT NULL,
	`idx` integer DEFAULT 0 NOT NULL,
	`emoji` text NOT NULL,
	`name` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`collection_id` text,
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `favorite_idx_order` ON `favorite` (`idx`);--> statement-breakpoint
CREATE INDEX `favorite_collection_id_idx` ON `favorite` (`collection_id`);--> statement-breakpoint
CREATE TABLE `tag_order` (
	`collection_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`sort_index` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `tag_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tag_order_collection_sort_idx` ON `tag_order` (`collection_id`,`sort_index`);