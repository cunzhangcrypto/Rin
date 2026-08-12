ALTER TABLE `feeds` ADD COLUMN `ai_visible` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '11' WHERE `key` = 'migration_version';
