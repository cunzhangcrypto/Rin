ALTER TABLE `feeds` ADD COLUMN `recommended` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '10' WHERE `key` = 'migration_version';
