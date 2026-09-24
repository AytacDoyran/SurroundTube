CREATE TABLE `youtube_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`scope` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `youtube_connections_openId_unique` UNIQUE(`openId`)
);
