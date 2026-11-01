ALTER TABLE `consult_requests` ADD COLUMN `proof_image` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `info` SET `value` = '16' WHERE `key` = 'migration_version';
