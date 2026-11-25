-- CreateTable
CREATE TABLE `prenotazione` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `codice_pubblico` VARCHAR(32) NOT NULL,
    `cliente_id` BIGINT NOT NULL,
    `stato` ENUM('richiesta', 'confermata', 'rifiutata', 'annullata') NOT NULL DEFAULT 'richiesta',
    `motivo_stato` VARCHAR(200) NULL,
    `persone` INTEGER NOT NULL,
    `inizio` DATETIME(3) NOT NULL,
    `note` TEXT NULL,
    `tavolo_note` VARCHAR(100) NULL,
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aggiornato_il` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prenotazione_codice_pubblico_key`(`codice_pubblico`),
    INDEX `prenotazione_cliente_id_stato_idx`(`cliente_id`, `stato`),
    INDEX `prenotazione_stato_inizio_idx`(`stato`, `inizio`),
    INDEX `prenotazione_inizio_idx`(`inizio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `prenotazione` ADD CONSTRAINT `prenotazione_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
