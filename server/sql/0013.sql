CREATE TABLE IF NOT EXISTS `consult_requests` (
  `id` integer PRIMARY KEY NOT NULL,
  `request_no` text NOT NULL,
  `category` text NOT NULL,
  `package_type` text NOT NULL,
  `package_price` integer DEFAULT 0 NOT NULL,
  `problem` text NOT NULL,
  `expected` text NOT NULL,
  `contact_type` text NOT NULL,
  `contact_account` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `payment_status` text DEFAULT 'unpaid' NOT NULL,
  `admin_note` text DEFAULT '' NOT NULL,
  `is_read` integer DEFAULT 0 NOT NULL,
  `read_at` integer,
  `notify_status` text DEFAULT 'pending' NOT NULL,
  `notified_at` integer,
  `notify_error` text DEFAULT '' NOT NULL,
  `notify_attempts` integer DEFAULT 0 NOT NULL,
  `ip_hash` text DEFAULT '' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `consult_requests_request_no_idx` ON `consult_requests` (`request_no`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `consult_requests_created_at_idx` ON `consult_requests` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `consult_requests_is_read_idx` ON `consult_requests` (`is_read`);
--> statement-breakpoint
UPDATE `info` SET `value` = '13' WHERE `key` = 'migration_version';
