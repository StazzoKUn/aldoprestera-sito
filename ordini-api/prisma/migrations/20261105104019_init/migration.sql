-- CreateTable
CREATE TABLE `cliente` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `cognome` VARCHAR(100) NOT NULL,
    `telefono` VARCHAR(32) NULL,
    `codice_fiscale` VARCHAR(16) NULL,
    `partita_iva` VARCHAR(16) NULL,
    `stripe_customer_id` VARCHAR(255) NULL,
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aggiornato_il` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cliente_email_key`(`email`),
    UNIQUE INDEX `cliente_stripe_customer_id_key`(`stripe_customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `indirizzo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `cliente_id` BIGINT NOT NULL,
    `destinatario` VARCHAR(150) NOT NULL,
    `via` VARCHAR(255) NOT NULL,
    `cap` VARCHAR(16) NOT NULL,
    `citta` VARCHAR(100) NOT NULL,
    `provincia` VARCHAR(64) NOT NULL,
    `nazione` CHAR(2) NOT NULL,
    `predefinito` BOOLEAN NOT NULL DEFAULT false,

    INDEX `indirizzo_cliente_id_idx`(`cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prodotto` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(64) NOT NULL,
    `nome` VARCHAR(200) NOT NULL,
    `descrizione` TEXT NULL,
    `prezzo` DECIMAL(10, 2) NOT NULL,
    `valuta` CHAR(3) NOT NULL DEFAULT 'EUR',
    `aliquota_iva` DECIMAL(5, 2) NOT NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `prodotto_sku_key`(`sku`),
    INDEX `prodotto_attivo_idx`(`attivo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ordine` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `numero_ordine` VARCHAR(20) NOT NULL,
    `cliente_id` BIGINT NOT NULL,
    `indirizzo_spedizione_id` BIGINT NULL,
    `indirizzo_fatturazione_id` BIGINT NULL,
    `stato` ENUM('bozza', 'confermato', 'spedito', 'consegnato', 'annullato') NOT NULL DEFAULT 'bozza',
    `totale` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `valuta` CHAR(3) NOT NULL DEFAULT 'EUR',
    `note` TEXT NULL,
    `creato_il` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `aggiornato_il` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ordine_numero_ordine_key`(`numero_ordine`),
    INDEX `ordine_cliente_id_stato_idx`(`cliente_id`, `stato`),
    INDEX `ordine_stato_idx`(`stato`),
    INDEX `ordine_indirizzo_spedizione_id_idx`(`indirizzo_spedizione_id`),
    INDEX `ordine_indirizzo_fatturazione_id_idx`(`indirizzo_fatturazione_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `riga_ordine` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `ordine_id` BIGINT NOT NULL,
    `prodotto_id` BIGINT NOT NULL,
    `nome_prodotto` VARCHAR(200) NOT NULL,
    `sku` VARCHAR(64) NOT NULL,
    `quantita` INTEGER NOT NULL,
    `prezzo_unitario` DECIMAL(10, 2) NOT NULL,
    `aliquota_iva` DECIMAL(5, 2) NOT NULL,
    `totale_riga` DECIMAL(10, 2) NOT NULL,

    INDEX `riga_ordine_ordine_id_idx`(`ordine_id`),
    INDEX `riga_ordine_prodotto_id_idx`(`prodotto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `indirizzo` ADD CONSTRAINT `indirizzo_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordine` ADD CONSTRAINT `ordine_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordine` ADD CONSTRAINT `ordine_indirizzo_spedizione_id_fkey` FOREIGN KEY (`indirizzo_spedizione_id`) REFERENCES `indirizzo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ordine` ADD CONSTRAINT `ordine_indirizzo_fatturazione_id_fkey` FOREIGN KEY (`indirizzo_fatturazione_id`) REFERENCES `indirizzo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `riga_ordine` ADD CONSTRAINT `riga_ordine_ordine_id_fkey` FOREIGN KEY (`ordine_id`) REFERENCES `ordine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `riga_ordine` ADD CONSTRAINT `riga_ordine_prodotto_id_fkey` FOREIGN KEY (`prodotto_id`) REFERENCES `prodotto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
