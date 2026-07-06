CREATE TABLE `callback_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`api_id` integer NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`callback_url` text,
	`callback_method` text DEFAULT 'POST' NOT NULL,
	`callback_headers` text,
	`callback_body` text,
	`delay_type` text DEFAULT 'fixed' NOT NULL,
	`delay_value` text DEFAULT '0' NOT NULL,
	`retry_enabled` integer DEFAULT false NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`retry_interval` integer DEFAULT 5000 NOT NULL,
	`retry_strategy` text DEFAULT 'fixed' NOT NULL,
	`retry_condition` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`api_id`) REFERENCES `mock_apis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `callback_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`callback_config_id` integer NOT NULL,
	`api_id` integer NOT NULL,
	`request_id` text,
	`callback_url` text NOT NULL,
	`callback_method` text NOT NULL,
	`callback_headers` text,
	`callback_body` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`next_retry_at` integer,
	`response_status` integer,
	`response_body` text,
	`error_message` text,
	`scheduled_at` integer NOT NULL,
	`sent_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`callback_config_id`) REFERENCES `callback_configs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`api_id`) REFERENCES `mock_apis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ct_status_scheduled` ON `callback_tasks` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `idx_ct_api_created` ON `callback_tasks` (`api_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `feature_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_fg_project_name` ON `feature_groups` (`project_id`,`name`);--> statement-breakpoint
CREATE INDEX `idx_fg_project` ON `feature_groups` (`project_id`);--> statement-breakpoint
CREATE TABLE `mock_apis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feature_group_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`response_status` integer DEFAULT 200 NOT NULL,
	`response_delay` integer DEFAULT 0 NOT NULL,
	`response_delay_max` integer DEFAULT 0 NOT NULL,
	`response_content_type` text DEFAULT 'application/json' NOT NULL,
	`response_headers` text,
	`response_body` text,
	`validation_rules` text,
	`data_op` text DEFAULT 'none' NOT NULL,
	`data_table` text,
	`data_where` text,
	`script` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`feature_group_id`) REFERENCES `feature_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_apis_fg` ON `mock_apis` (`feature_group_id`);--> statement-breakpoint
CREATE INDEX `idx_apis_method_path` ON `mock_apis` (`method`,`path`);--> statement-breakpoint
CREATE TABLE `mock_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`api_id` integer NOT NULL,
	`data_key` text,
	`data_value` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`api_id`) REFERENCES `mock_apis`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_md_api` ON `mock_data` (`api_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_projects_name` ON `projects` (`name`);--> statement-breakpoint
CREATE TABLE `request_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`api_id` integer,
	`request_method` text,
	`request_path` text,
	`request_params` text,
	`request_body` text,
	`request_headers` text,
	`response_status` integer,
	`response_body` text,
	`response_time` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`api_id`) REFERENCES `mock_apis`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_rl_api_created` ON `request_logs` (`api_id`,`created_at`);