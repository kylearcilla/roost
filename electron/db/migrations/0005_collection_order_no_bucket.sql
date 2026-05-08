PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_collection_order` (
	`collection_id` text PRIMARY KEY NOT NULL,
	`sort_index` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `collection`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_collection_order`("collection_id", "sort_index") SELECT "collection_id", MIN("sort_index") AS "sort_index" FROM `collection_order` GROUP BY "collection_id";--> statement-breakpoint
DROP TABLE `collection_order`;--> statement-breakpoint
ALTER TABLE `__new_collection_order` RENAME TO `collection_order`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `collection_order_sort_idx` ON `collection_order` (`sort_index`);