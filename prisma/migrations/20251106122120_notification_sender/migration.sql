-- AlterTable
ALTER TABLE `Notification` ADD COLUMN `sendingUserId` INTEGER NOT NULL DEFAULT -1;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_sendingUserId_fkey` FOREIGN KEY (`sendingUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
