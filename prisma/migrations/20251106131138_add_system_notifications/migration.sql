-- CreateTable
CREATE TABLE `SystemNotification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `icon` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SystemNotification_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemNotificationRead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `systemNotificationId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `readAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SystemNotificationRead_userId_idx`(`userId`),
    UNIQUE INDEX `SystemNotificationRead_systemNotificationId_userId_key`(`systemNotificationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SystemNotificationRead` ADD CONSTRAINT `SystemNotificationRead_systemNotificationId_fkey` FOREIGN KEY (`systemNotificationId`) REFERENCES `SystemNotification`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
