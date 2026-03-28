-- AlterTable
ALTER TABLE `Region` ADD COLUMN `population` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Region_population_idx` ON `Region`(`population`);
