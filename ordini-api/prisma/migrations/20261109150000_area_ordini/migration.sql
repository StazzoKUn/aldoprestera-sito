-- Area ordini: nuovi stati, dati salvati sull'ordine, rimborsi, utente e sessione.
-- Pensata per tabelle ordine/cliente vuote (dati di prova azzerati il 2026-11-09): niente backfill.
-- AlterTable
ALTER TABLE `ordine` ADD COLUMN `citofono` VARCHAR(80) NULL,
    ADD COLUMN `codice_pubblico` VARCHAR(32) NOT NULL,
    ADD COLUMN `metodo_pagamento` VARCHAR(32) NOT NULL,
    ADD COLUMN `modalita` ENUM('consegna', 'asporto') NOT NULL,
    ADD COLUMN `motivo_stato` VARCHAR(200) NULL,
    ADD COLUMN `nome_cliente` VARCHAR(150) NOT NULL,
    ADD COLUMN `orario_richiesto` DATETIME(3) NOT NULL,
    ADD COLUMN `telefono_cliente` VARCHAR(32) NOT NULL,
    ADD COLUMN `totale_rimborsato` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    MODIFY `stato` ENUM('bozza', 'ricevuto', 'accettato', 'consegnato', 'rifiutato', 'annullato') NOT NULL DEFAULT 'bozza';

-- CreateTable
CREATE TABLE `rimborso` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ordine_id` BIGINT NOT NULL,
    `importo` DECIMAL(10, 2) NOT NULL,
    `quota_consegna` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `metodo` VARCHAR(32) NOT NULL,
    `motivo` VARCHAR(200) NOT NULL,
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rimborso_ordine_id_idx`(`ordine_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rimborso_riga` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `rimborso_id` BIGINT NOT NULL,
    `riga_ordine_id` BIGINT NOT NULL,
    `quantita` INTEGER NOT NULL,
    `importo` DECIMAL(10, 2) NOT NULL,

    INDEX `rimborso_riga_rimborso_id_idx`(`rimborso_id`),
    INDEX `rimborso_riga_riga_ordine_id_idx`(`riga_ordine_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utente` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `tentativi_falliti` INTEGER NOT NULL DEFAULT 0,
    `bloccato_fino` DATETIME(3) NULL,
    `ultimo_accesso` DATETIME(3) NULL,
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `utente_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessione` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `utente_id` BIGINT NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `scade_il` DATETIME(3) NOT NULL,
    `ultimo_uso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessione_token_hash_key`(`token_hash`),
    INDEX `sessione_utente_id_idx`(`utente_id`),
    INDEX `sessione_scade_il_idx`(`scade_il`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ordine_codice_pubblico_key` ON `ordine`(`codice_pubblico`);

-- CreateIndex
CREATE INDEX `ordine_stato_orario_richiesto_idx` ON `ordine`(`stato`, `orario_richiesto`);

-- CreateIndex
CREATE INDEX `ordine_orario_richiesto_idx` ON `ordine`(`orario_richiesto`);

-- AddForeignKey
ALTER TABLE `rimborso` ADD CONSTRAINT `rimborso_ordine_id_fkey` FOREIGN KEY (`ordine_id`) REFERENCES `ordine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rimborso_riga` ADD CONSTRAINT `rimborso_riga_rimborso_id_fkey` FOREIGN KEY (`rimborso_id`) REFERENCES `rimborso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rimborso_riga` ADD CONSTRAINT `rimborso_riga_riga_ordine_id_fkey` FOREIGN KEY (`riga_ordine_id`) REFERENCES `riga_ordine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessione` ADD CONSTRAINT `sessione_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

