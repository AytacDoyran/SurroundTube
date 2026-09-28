CREATE TABLE `media_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mediaId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`userName` varchar(255) NOT NULL,
	`text` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mediaId` int NOT NULL,
	`userOpenId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_likes_id` PRIMARY KEY(`id`),
	CONSTRAINT `media_likes_media_user_unique` UNIQUE(`mediaId`,`userOpenId`)
);
--> statement-breakpoint
ALTER TABLE `media_uploads` ADD `viewsCount` int DEFAULT 0 NOT NULL;