CREATE TABLE `media_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`originalFilename` varchar(255) NOT NULL,
	`processedKey` text,
	`processedUrl` text,
	`mimeType` varchar(100) NOT NULL,
	`sizeBytes` int NOT NULL,
	`status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_uploads_id` PRIMARY KEY(`id`)
);
