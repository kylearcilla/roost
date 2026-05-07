CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`url` text,
	`path` text,
	`dims` text DEFAULT 'default' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collection` (
	`id` text PRIMARY KEY NOT NULL,
	`idx` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`headline` text,
	`emoji` text,
	`subtitle` text,
	`column_size` text DEFAULT 'medium' NOT NULL,
	`item_count` integer,
	`wallpaper_id` text,
	`wallpaper_focus_y` real,
	FOREIGN KEY (`wallpaper_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `collection_idx_order` ON `collection` (`idx`);