import type { PoolConnection } from 'mysql2/promise';

export async function up(connection: PoolConnection): Promise<void> {
  await connection.query(`
    INSERT INTO master_supplier (kode, nama, telepon, alamat, status) VALUES
      ('SUP-001', 'PT Kopi Nusantara', '021-5550101', 'Jl. Sudirman No. 10, Jakarta', 'aktif'),
      ('SUP-002', 'CV Sumber Pangan', '022-5550202', 'Jl. Asia Afrika No. 20, Bandung', 'aktif'),
      ('SUP-003', 'UD Mitra Sejahtera', '031-5550303', 'Jl. Pemuda No. 30, Surabaya', 'nonaktif')
  `);

  await connection.query(`
    INSERT INTO master_barang (kode, nama, satuan, harga_beli, harga_jual, stok) VALUES
      ('BRG-001', 'Kopi Arabica 250g', 'pack', 45000.00, 65000.00, 0),
      ('BRG-002', 'Kopi Robusta 250g', 'pack', 35000.00, 50000.00, 0),
      ('BRG-003', 'Gula Pasir 1kg', 'pack', 15000.00, 18000.00, 0),
      ('BRG-004', 'Susu UHT 1L', 'pcs', 18000.00, 22000.00, 0),
      ('BRG-005', 'Teh Celup 100s', 'box', 12000.00, 16000.00, 0)
  `);
}
