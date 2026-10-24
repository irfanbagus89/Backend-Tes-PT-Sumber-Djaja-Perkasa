import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CreatePembelianDto } from './dto/create-pembelian.dto.js';
import { UpdatePembelianDto } from './dto/update-pembelian.dto.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['diproses', 'dibatalkan'],
  diproses: [],
  diterima: [],
  dibatalkan: [],
};

const PEMBELIAN_COLUMNS = `id, no_pembelian, tanggal, supplier_id, total, status, created_at, updated_at`;
const PEMBELIAN_DETAIL_COLUMNS = `pd.id, pd.pembelian_id, pd.barang_id, pd.qty, pd.harga, pd.subtotal`;

@Injectable()
export class PembelianService {
  constructor(private db: DatabaseService) {}

  private generateNoPembelian(): string {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `PO-${ymd}-${rand}`;
  }

  async createPembelian(
    dto: CreatePembelianDto,
  ): Promise<{ no_pembelian: string; total: number }> {
    const supplierRows = await this.db.query<{
      id: number;
      nama: string;
      status: string;
    }>('SELECT id, nama, status FROM master_supplier WHERE id = ?', [
      dto.supplier_id,
    ]);
    const supplier = supplierRows[0] ?? null;
    if (!supplier) {
      throw new NotFoundException(
        `Supplier dengan id ${dto.supplier_id} tidak ditemukan`,
      );
    }
    if (supplier.status !== 'aktif') {
      throw new BadRequestException(
        `Supplier '${supplier.nama}' berstatus nonaktif dan tidak dapat dipakai untuk pembelian baru`,
      );
    }

    const itemsToInsert = await this.resolveItems(dto.items);
    const total = itemsToInsert.reduce((sum, i) => sum + i.subtotal, 0);

    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const noPembelian = this.generateNoPembelian();
      const [headerResult] = await conn.query(
        `INSERT INTO pembelian (no_pembelian, tanggal, supplier_id, total) VALUES (?, ?, ?, ?)`,
        [noPembelian, dto.tanggal, dto.supplier_id, total],
      );
      const pembelianId = (headerResult as { insertId: number }).insertId;

      for (const item of itemsToInsert) {
        await conn.query(
          `INSERT INTO pembelian_detail (pembelian_id, barang_id, qty, harga, subtotal)
           VALUES (?, ?, ?, ?, ?)`,
          [pembelianId, item.barang_id, item.qty, item.harga, item.subtotal],
        );
      }

      await conn.commit();
      return { no_pembelian: noPembelian, total };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getPembelians(params: {
    status?: string;
    search?: string;
    supplierId?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    items: { [key: string]: any }[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 10;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status) {
      if (
        !['draft', 'diproses', 'diterima', 'dibatalkan'].includes(params.status)
      ) {
        throw new BadRequestException(
          'Filter status harus: draft, diproses, diterima, atau dibatalkan',
        );
      }
      conditions.push('p.status = ?');
      values.push(params.status);
    }
    if (params.search) {
      conditions.push('p.no_pembelian LIKE ?');
      values.push(`%${params.search}%`);
    }
    if (params.supplierId) {
      conditions.push('p.supplier_id = ?');
      values.push(params.supplierId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.db.query<{ [key: string]: any }>(
      `SELECT ${PEMBELIAN_COLUMNS.split(', ').map((c) => `p.${c}`).join(', ')},
              s.kode AS supplier_kode, s.nama AS supplier_nama
       FROM pembelian p
       JOIN master_supplier s ON s.id = p.supplier_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );

    const countRows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM pembelian p ${where}`,
      values,
    );

    return {
      items: rows.map((r) => ({
        ...r,
        supplier: {
          id: r.supplier_id,
          kode: r.supplier_kode,
          nama: r.supplier_nama,
        },
        supplier_kode: undefined,
        supplier_nama: undefined,
      })),
      pagination: { page, limit, total: countRows[0].total },
    };
  }

  async getPembelian(id: number): Promise<{ [key: string]: any }> {
    const headerRows = await this.db.query<{ [key: string]: any }>(
      `SELECT ${PEMBELIAN_COLUMNS.split(', ').map((c) => `p.${c}`).join(', ')},
              s.kode AS supplier_kode, s.nama AS supplier_nama,
              s.telepon AS supplier_telepon, s.alamat AS supplier_alamat
       FROM pembelian p
       JOIN master_supplier s ON s.id = p.supplier_id
       WHERE p.id = ?`,
      [id],
    );
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Pembelian dengan id ${id} tidak ditemukan`);
    }

    const items = await this.db.query<{ [key: string]: any }>(
      `SELECT ${PEMBELIAN_DETAIL_COLUMNS}, b.kode AS barang_kode, b.nama AS barang_nama, b.satuan,
              COALESCE(diterima.qty_terima, 0) AS qty_diterima
       FROM pembelian_detail pd
       JOIN master_barang b ON b.id = pd.barang_id
       LEFT JOIN (
         SELECT pd2.pembelian_id, pd2.barang_id, SUM(pdet.qty_terima) AS qty_terima
         FROM pembelian_detail pd2
         JOIN penerimaan_detail pdet ON pdet.barang_id = pd2.barang_id
         JOIN penerimaan p ON p.id = pdet.penerimaan_id
         WHERE p.status = 'selesai' OR p.status = 'pending'
         GROUP BY pd2.pembelian_id, pd2.barang_id
       ) AS diterima ON diterima.pembelian_id = pd.pembelian_id AND diterima.barang_id = pd.barang_id
       WHERE pd.pembelian_id = ?
       ORDER BY pd.id ASC`,
      [id],
    );

    return {
      ...header,
      supplier: {
        id: header.supplier_id,
        kode: header.supplier_kode,
        nama: header.supplier_nama,
        telepon: header.supplier_telepon,
        alamat: header.supplier_alamat,
      },
      supplier_kode: undefined,
      supplier_nama: undefined,
      supplier_telepon: undefined,
      supplier_alamat: undefined,
      items,
    };
  }

  async updatePembelian(
    id: number,
    dto: UpdatePembelianDto,
  ): Promise<{ no_pembelian: string; total: number }> {
    const headerRows = await this.db.query<{
      id: number;
      no_pembelian: string;
      tanggal: string;
      supplier_id: number;
      status: 'draft' | 'diproses' | 'diterima' | 'dibatalkan';
      total: number;
    }>(`SELECT id, no_pembelian, tanggal, supplier_id, status, total FROM pembelian WHERE id = ?`, [id]);
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Pembelian dengan id ${id} tidak ditemukan`);
    }
    if (header.status !== 'draft') {
      throw new ConflictException(
        `Pembelian hanya dapat diubah saat status 'draft' (status saat ini: ${header.status})`,
      );
    }

    if (dto.supplier_id) {
      const supplierRows = await this.db.query<{
        id: number;
        nama: string;
        status: string;
      }>('SELECT id, nama, status FROM master_supplier WHERE id = ?', [
        dto.supplier_id,
      ]);
      const supplier = supplierRows[0] ?? null;
      if (!supplier) {
        throw new NotFoundException(
          `Supplier dengan id ${dto.supplier_id} tidak ditemukan`,
        );
      }
      if (supplier.status !== 'aktif') {
        throw new BadRequestException(
          `Supplier '${supplier.nama}' berstatus nonaktif dan tidak dapat dipakai`,
        );
      }
    }

    let itemsToInsert: {
      barang_id: number;
      qty: number;
      harga: number;
      subtotal: number;
    }[] = [];
    let total = Number(header.total);

    if (dto.items) {
      itemsToInsert = await this.resolveItems(dto.items);
      total = itemsToInsert.reduce((sum, i) => sum + i.subtotal, 0);
    }

    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `UPDATE pembelian SET tanggal = ?, supplier_id = ?, total = ? WHERE id = ?`,
        [
          dto.tanggal ?? header.tanggal,
          dto.supplier_id ?? header.supplier_id,
          total,
          id,
        ],
      );

      if (dto.items) {
        await conn.query(
          'DELETE FROM pembelian_detail WHERE pembelian_id = ?',
          [id],
        );
        for (const item of itemsToInsert) {
          await conn.query(
            `INSERT INTO pembelian_detail (pembelian_id, barang_id, qty, harga, subtotal)
             VALUES (?, ?, ?, ?, ?)`,
            [id, item.barang_id, item.qty, item.harga, item.subtotal],
          );
        }
      }

      await conn.commit();
      return { no_pembelian: header.no_pembelian, total };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updatePembelianStatus(
    id: number,
    newStatus: 'diproses' | 'dibatalkan',
  ): Promise<{ no_pembelian: string; status: string }> {
    const headerRows = await this.db.query<{
      id: number;
      no_pembelian: string;
      status: 'draft' | 'diproses' | 'diterima' | 'dibatalkan';
    }>('SELECT id, no_pembelian, status FROM pembelian WHERE id = ?', [id]);
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Pembelian dengan id ${id} tidak ditemukan`);
    }

    const allowed = VALID_TRANSITIONS[header.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictException(
        `Transisi status dari '${header.status}' ke '${newStatus}' tidak diizinkan. Transisi valid: ${allowed.length ? allowed.join(', ') : 'tidak ada (status final)'}`,
      );
    }

    if (newStatus === 'dibatalkan') {
      const usedRows = await this.db.query<{ total: number }>(
        'SELECT COUNT(*) AS total FROM penerimaan WHERE pembelian_id = ?',
        [id],
      );
      const totalPenerimaan =
        usedRows.length > 0 ? Number(usedRows[0].total) : 0;
      if (totalPenerimaan > 0) {
        throw new ConflictException(
          `Pembelian tidak dapat dibatalkan karena sudah ada ${totalPenerimaan} penerimaan terkait`,
        );
      }
    }

    await this.db
      .getPool()
      .query('UPDATE pembelian SET status = ? WHERE id = ?', [newStatus, id]);
    return { no_pembelian: header.no_pembelian, status: newStatus };
  }

  async removePembelian(id: number): Promise<{ message: string }> {
    const headerRows = await this.db.query<{
      id: number;
      no_pembelian: string;
      status: 'draft' | 'diproses' | 'diterima' | 'dibatalkan';
    }>('SELECT id, no_pembelian, status FROM pembelian WHERE id = ?', [id]);
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Pembelian dengan id ${id} tidak ditemukan`);
    }
    if (header.status !== 'draft') {
      throw new ConflictException(
        `Pembelian hanya dapat dihapus saat status 'draft' (status saat ini: ${header.status})`,
      );
    }

    await this.db.getPool().query('DELETE FROM pembelian WHERE id = ?', [id]);
    return { message: `Pembelian '${header.no_pembelian}' berhasil dihapus` };
  }

  private async resolveItems(
    items: { barang_id: number; qty: number; harga?: number }[],
  ): Promise<
    { barang_id: number; qty: number; harga: number; subtotal: number }[]
  > {
    const barangIds = items.map((i) => i.barang_id);
    if (new Set(barangIds).size !== barangIds.length) {
      throw new BadRequestException('Terdapat barang duplikat di dalam items');
    }

    const placeholders = barangIds.map(() => '?').join(', ');
    const barangRows = await this.db.query<{
      id: number;
      kode: string;
      nama: string;
      satuan: string;
      harga_beli: number;
    }>(
      `SELECT id, kode, nama, satuan, harga_beli FROM master_barang WHERE id IN (${placeholders})`,
      barangIds,
    );
    if (barangRows.length !== barangIds.length) {
      const foundIds = new Set(barangRows.map((b) => b.id));
      const missing = barangIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Barang dengan id berikut tidak ditemukan: ${missing.join(', ')}`,
      );
    }
    const barangMap = new Map(barangRows.map((b) => [b.id, b]));

    return items.map((item) => {
      const barang = barangMap.get(item.barang_id)!;
      const harga = item.harga ?? Number(barang.harga_beli);
      return {
        barang_id: item.barang_id,
        qty: item.qty,
        harga,
        subtotal: item.qty * harga,
      };
    });
  }
}
