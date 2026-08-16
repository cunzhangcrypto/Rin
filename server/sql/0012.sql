ALTER TABLE `feeds` ADD COLUMN `recommend_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '12' WHERE `key` = 'migration_version';
