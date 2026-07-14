-- 多回调链支持：callback_configs 去掉唯一约束，新增 sort_order / name；
-- callback_tasks 新增 template_context 用于链上下文传递
ALTER TABLE `callback_configs` ADD `name` text;--> statement-breakpoint
ALTER TABLE `callback_configs` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DROP INDEX `uniq_callback_api`;--> statement-breakpoint
CREATE INDEX `idx_cc_api_sort` ON `callback_configs` (`api_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `callback_tasks` ADD `template_context` text;