import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service.js';
import { CreateBarangDto } from './dto/create-barang.dto.js';
import { UpdateBarangDto } from './dto/update-barang.dto.js';

@Injectable()
export class BarangService {
  private readonly barangColumns = `id, kode, nama, satuan, harga_beli, harga_jual, stok, created_at, updated_at`;

  constructor(private db: DatabaseService) {}

  private generateKodeBarang(): string {
    const now = new Date();
    const tanggal = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `BRG-${tanggal}-${random}`;
  }

  async createBarang(dto: CreateBarangDto): Promise<{ kode: string; nama: string }> {
    const kode = this.generateKodeBarang();

    await this.db.getPool().query(
      `INSERT INTO master_barang (kode, nama, satuan, harga_beli, harga_jual)
       VALUES (?, ?, ?, ?, ?)`,
      [kode, dto.nama, dto.satuan, dto.harga_beli, dto.harga_jual],
    );

    return { kode, nama: dto.nama };
  }

  async getBarangs(params: { search?: string; page?: number; limit?: number }): Promise<{
    items: {
      id: number;
      kode: string;
      nama: string;
      satuan: string;
      harga_beli: number;
      harga_jual: number;
      stok: number;
      created_at: Date;
      updated_at: Date;
    }[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 10;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      conditions.push('(kode LIKE ? OR nama LIKE ?)');
      values.push(`%${params.search}%`, `%${params.search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      satuan: string;
      harga_beli: number;
      harga_jual: number;
      stok: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT ${this.barangColumns} FROM master_barang ${where} ORDER BY nama ASC LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );

    const countRows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM master_barang ${where}`,
      values,
    );

    return {
      items: rows,
      pagination: { page, limit, total: countRows[0].total },
    };
  }

  async getBarang(id: number): Promise<{
    id: number;
    kode: string;
    nama: string;
    satuan: string;
    harga_beli: number;
    harga_jual: number;
    stok: number;
    created_at: Date;
    updated_at: Date;
  }> {
    const rows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      satuan: string;
      harga_beli: number;
      harga_jual: number;
      stok: number;
      created_at: Date;
      updated_at: Date;
    }>(`SELECT ${this.barangColumns} FROM master_barang WHERE id = ?`, [id]);
    const barang = rows[0] ?? null;
    if (!barang) {
      throw new NotFoundException(`Barang dengan id ${id} tidak ditemukan`);
    }
    return barang;
  }

  async updateBarang(
    id: number,
    dto: UpdateBarangDto,
  ): Promise<{ kode: string; nama: string }> {
    const barangRows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      satuan: string;
      harga_beli: number;
      harga_jual: number;
    }>(`SELECT id, kode, nama, satuan, harga_beli, harga_jual FROM master_barang WHERE id = ?`, [id]);
    const barang = barangRows[0] ?? null;
    if (!barang) {
      throw new NotFoundException(`Barang dengan id ${id} tidak ditemukan`);
    }

    await this.db.getPool().query(
      `UPDATE master_barang
       SET nama = ?, satuan = ?, harga_beli = ?, harga_jual = ?
       WHERE id = ?`,
      [
        dto.nama ?? barang.nama,
        dto.satuan ?? barang.satuan,
        dto.harga_beli ?? barang.harga_beli,
        dto.harga_jual ?? barang.harga_jual,
        id,
      ],
    );

    return { kode: barang.kode, nama: dto.nama ?? barang.nama };
  }

  async removeBarang(id: number): Promise<{ message: string }> {
    const barangRows = await this.db.query<{ id: number; nama: string }>(
      'SELECT id, nama FROM master_barang WHERE id = ?',
      [id],
    );
    const barang = barangRows[0] ?? null;
    if (!barang) {
      throw new NotFoundException(`Barang dengan id ${id} tidak ditemukan`);
    }

    const usedPembelianRows = await this.db.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM pembelian_detail WHERE barang_id = ?',
      [id],
    );
    const usedPenerimaanRows = await this.db.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM penerimaan_detail WHERE barang_id = ?',
      [id],
    );

    const totalPembelian = usedPembelianRows.length > 0 ? Number(usedPembelianRows[0].total) : 0;
    const totalPenerimaan = usedPenerimaanRows.length > 0 ? Number(usedPenerimaanRows[0].total) : 0;

    if (totalPembelian > 0 || totalPenerimaan > 0) {
      throw new BadRequestException(
        `Barang '${barang.nama}' tidak dapat dihapus karena sudah dipakai di transaksi (pembelian: ${totalPembelian}, penerimaan: ${totalPenerimaan}).`,
      );
    }

    await this.db.getPool().query('DELETE FROM master_barang WHERE id = ?', [id]);
    return { message: `Barang '${barang.nama}' berhasil dihapus` };
  }
}
