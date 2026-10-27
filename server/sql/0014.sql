ALTER TABLE `feeds` ADD COLUMN `categories` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '14' WHERE `key` = 'migration_version';
