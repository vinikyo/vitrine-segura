CREATE TABLE `limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`buyer` text NOT NULL,
	`seller` text NOT NULL,
	`product` text NOT NULL,
	`quantity` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text NOT NULL,
	`delivery` text NOT NULL,
	`created` text NOT NULL,
	`nonce` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_nonce_unique` ON `orders` (`nonce`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
