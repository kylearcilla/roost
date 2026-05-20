ALTER TABLE `collection` ADD COLUMN `pin_id` text;--> statement-breakpoint
ALTER TABLE `collection` ADD COLUMN `group_id` text;--> statement-breakpoint
CREATE INDEX `collection_pin_anchor_idx` ON `collection` (`pin_id`);
