ALTER TABLE `request_logs` ADD `client_ip` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `request_id` text;--> statement-breakpoint
ALTER TABLE `request_logs` ADD `format` text;--> statement-breakpoint
CREATE INDEX `idx_rl_created` ON `request_logs` (`created_at`);