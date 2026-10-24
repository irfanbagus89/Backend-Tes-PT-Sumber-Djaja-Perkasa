import type { PoolConnection } from 'mysql2/promise';

export async function up(connection: PoolConnection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS master_supplier (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kode VARCHAR(30) NOT NULL UNIQUE,
      nama VARCHAR(150) NOT NULL,
      telepon VARCHAR(20) NULL,
      alamat VARCHAR(255) NULL,
      status ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS master_barang (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kode VARCHAR(30) NOT NULL UNIQUE,
      nama VARCHAR(150) NOT NULL,
      satuan VARCHAR(30) NOT NULL,
      harga_beli DECIMAL(14, 2) NOT NULL DEFAULT 0,
      harga_jual DECIMAL(14, 2) NOT NULL DEFAULT 0,
      stok INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS pembelian (
      id INT AUTO_INCREMENT PRIMARY KEY,
      no_pembelian VARCHAR(30) NOT NULL UNIQUE,
      tanggal DATE NOT NULL,
      supplier_id INT NOT NULL,
      status ENUM('draft', 'diproses', 'diterima', 'dibatalkan') NOT NULL DEFAULT 'draft',
      total DECIMAL(14, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pembelian_supplier
        FOREIGN KEY (supplier_id) REFERENCES master_supplier(id),
      INDEX idx_pembelian_status (status),
      INDEX idx_pembelian_supplier (supplier_id)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS pembelian_detail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      pembelian_id INT NOT NULL,
      barang_id INT NOT NULL,
      qty INT NOT NULL,
      harga DECIMAL(14, 2) NOT NULL,
      subtotal DECIMAL(14, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_pembelian_detail_pembelian
        FOREIGN KEY (pembelian_id) REFERENCES pembelian(id) ON DELETE CASCADE,
      CONSTRAINT fk_pembelian_detail_barang
        FOREIGN KEY (barang_id) REFERENCES master_barang(id),
      CONSTRAINT chk_qty_positif CHECK (qty > 0),
      UNIQUE KEY uq_pembelian_barang (pembelian_id, barang_id),
      INDEX idx_pembelian_detail_barang (barang_id)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS penerimaan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      no_penerimaan VARCHAR(30) NOT NULL UNIQUE,
      pembelian_id INT NOT NULL,
      tanggal DATE NOT NULL,
      status ENUM('pending', 'selesai') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_penerimaan_pembelian
        FOREIGN KEY (pembelian_id) REFERENCES pembelian(id),
      INDEX idx_penerimaan_status (status),
      INDEX idx_penerimaan_pembelian (pembelian_id)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS penerimaan_detail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      penerimaan_id INT NOT NULL,
      barang_id INT NOT NULL,
      qty_terima INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_penerimaan_detail_penerimaan
        FOREIGN KEY (penerimaan_id) REFERENCES penerimaan(id) ON DELETE CASCADE,
      CONSTRAINT fk_penerimaan_detail_barang
        FOREIGN KEY (barang_id) REFERENCES master_barang(id),
      CONSTRAINT chk_qty_terima_positif CHECK (qty_terima > 0),
      UNIQUE KEY uq_penerimaan_barang (penerimaan_id, barang_id),
      INDEX idx_penerimaan_detail_barang (barang_id)
    ) ENGINE=InnoDB
  `);
}
