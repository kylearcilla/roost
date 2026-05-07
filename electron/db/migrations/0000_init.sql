CREATE TABLE IF NOT EXISTS `library_item` (
	`id` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`provider` text NOT NULL,
	`title` text,
	`fetched_at` integer NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `library_item_source_url_unique` ON `library_item` (`source_url`);
