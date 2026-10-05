CREATE TABLE `channel_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `channel_subscriptions_channel_user_unique` UNIQUE(`channelId`,`userOpenId`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`handle` varchar(80) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `channels_ownerOpenId_unique` UNIQUE(`ownerOpenId`),
	CONSTRAINT `channels_handle_unique` UNIQUE(`handle`)
);
--> statement-breakpoint
ALTER TABLE `media_uploads` ADD `channelId` int;