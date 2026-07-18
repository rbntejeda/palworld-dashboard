-- CreateTable
CREATE TABLE `snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `snapshotAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `uptimeSeconds` INTEGER NOT NULL,
    `wsState` VARCHAR(32) NOT NULL,
    `serviceState` VARCHAR(16) NOT NULL,
    `players` INTEGER NOT NULL,
    `maxPlayers` INTEGER NOT NULL,
    `cpuLoad` DOUBLE NOT NULL,
    `memoryUsed` DOUBLE NOT NULL,
    `memoryTotal` DOUBLE NOT NULL,
    `memoryUsagePercent` DOUBLE NOT NULL,
    `serverTemperatureC` DOUBLE NULL,
    `serverTemperatureSource` VARCHAR(64) NULL,
    `latency` DOUBLE NOT NULL,
    `note` TEXT NOT NULL,
    `probeTarget` VARCHAR(255) NOT NULL,
    `map` JSON NOT NULL,
    `rest` JSON NOT NULL,

    INDEX `snapshots_snapshotAt_idx`(`snapshotAt`),
    INDEX `snapshots_serviceState_idx`(`serviceState`),
    INDEX `snapshots_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
