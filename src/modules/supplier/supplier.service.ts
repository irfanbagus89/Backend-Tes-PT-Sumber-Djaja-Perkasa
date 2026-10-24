import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';

@Injectable()
export class SupplierService {

  constructor(private db: DatabaseService) {}

private generateKodeSupplier(): string {
    const now = new Date();
    const tanggal = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `SUP-${tanggal}-${random}`;
  }

  private normalizeTelepon(telepon: string): string {
    return telepon.startsWith('62') ? `0${telepon.slice(2)}` : telepon;
  }

  async createSupplier(
    dto: CreateSupplierDto,
  ): Promise<{ kode: string; nama: string }> {
    const kode = this.generateKodeSupplier();

    await this.db.getPool().query(
      `INSERT INTO master_supplier (kode, nama, telepon, alamat) VALUES (?, ?, ?, ?)`,
      [kode, dto.nama, this.normalizeTelepon(dto.telepon), dto.alamat],
    );

    return { kode, nama: dto.nama };
  }


  async getSuppliers(params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: {
      id: number;
      kode: string;
      nama: string;
      telepon: null | string;
      alamat: null | string;
      status: 'aktif' | 'nonaktif';
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
    if (params.status) {
      if (params.status !== 'aktif' && params.status !== 'nonaktif') {
        throw new BadRequestException('Filter status harus: aktif atau nonaktif');
      }
      conditions.push('status = ?');
      values.push(params.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      telepon: null | string;
      alamat: null | string;
      status: 'aktif' | 'nonaktif';
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, kode, nama, telepon, alamat, status, created_at, updated_at FROM master_supplier ${where} ORDER BY nama ASC LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );

    const countRows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM master_supplier ${where}`,
      values,
    );

    return {
      items: rows,
      pagination: { page, limit, total: countRows[0].total },
    };
  }

  async getSupplier(id: number): Promise<{
    id: number;
    kode: string;
    nama: string;
    telepon: null | string;
    alamat: null | string;
    status: 'aktif' | 'nonaktif';
    created_at: Date;
    updated_at: Date;
    statistik: { jumlah_po: number; total_belanja: number };
  }> {
    const supplierRows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      telepon: null | string;
      alamat: null | string;
      status: 'aktif' | 'nonaktif';
      created_at: Date;
      updated_at: Date;
    }>(`SELECT id, kode, nama, telepon, alamat, status, created_at, updated_at FROM master_supplier WHERE id = ?`, [id]);
    const supplier = supplierRows[0] ?? null;
    if (!supplier) {
      throw new NotFoundException(`Supplier dengan id ${id} tidak ditemukan`);
    }

    const statsRows = await this.db.query<{
      jumlah_po: number;
      total_belanja: number;
    }>(
      `SELECT
         COUNT(*) AS jumlah_po,
         COALESCE(SUM(CASE WHEN status <> 'dibatalkan' THEN total ELSE 0 END), 0) AS total_belanja
       FROM pembelian WHERE supplier_id = ?`,
      [id],
    );

    return {
      ...supplier,
      statistik: statsRows[0],
    };
  }

  async updateSupplier(
    id: number,
    dto: UpdateSupplierDto,
  ): Promise<{ kode: string; nama: string }> {
    const supplierRows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      telepon: null | string;
      alamat: null | string;
      status: 'aktif' | 'nonaktif';
    }>(`SELECT id, kode, nama, telepon, alamat, status FROM master_supplier WHERE id = ?`, [id]);
    const supplier = supplierRows[0] ?? null;
    if (!supplier) {
      throw new NotFoundException(`Supplier dengan id ${id} tidak ditemukan`);
    }

    const teleponBaru =
      dto.telepon !== undefined ? this.normalizeTelepon(dto.telepon) : supplier.telepon;

    await this.db.getPool().query(
      `UPDATE master_supplier
       SET nama = ?, telepon = ?, alamat = ?, status = ?
       WHERE id = ?`,
      [
        dto.nama ?? supplier.nama,
        teleponBaru,
        dto.alamat !== undefined ? dto.alamat : supplier.alamat,
        dto.status ?? supplier.status,
        id,
      ],
    );

    return { kode: supplier.kode, nama: dto.nama ?? supplier.nama };
  }

  async removeSupplier(id: number): Promise<{ message: string }> {
    const supplierRows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
    }>('SELECT id, kode, nama FROM master_supplier WHERE id = ?', [id]);
    const supplier = supplierRows[0] ?? null;
    if (!supplier) {
      throw new NotFoundException(`Supplier dengan id ${id} tidak ditemukan`);
    }

    const usedRows = await this.db.query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM pembelian WHERE supplier_id = ?',
      [id],
    );
    const totalPembelian = usedRows.length > 0 ? Number(usedRows[0].total) : 0;
    if (totalPembelian > 0) {
      throw new ConflictException(
        `Supplier '${supplier.nama}' tidak dapat dihapus karena sudah dipakai di ${totalPembelian} pembelian. Ubah status menjadi 'nonaktif' sebagai gantinya.`,
      );
    }

    await this.db.getPool().query('DELETE FROM master_supplier WHERE id = ?', [id]);
    return { message: `Supplier '${supplier.nama}' berhasil dihapus` };
  }
}
