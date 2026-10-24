import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../../database/database.service.js';
import { CreatePenerimaanDto } from './dto/create-penerimaan.dto.js';

const PENERIMAAN_COLUMNS = `r.id, r.no_penerimaan, r.pembelian_id, r.tanggal, r.status, r.created_at, r.updated_at`;
const PENERIMAAN_DETAIL_COLUMNS = `rd.id, rd.penerimaan_id, rd.barang_id, rd.qty_terima`;

@Injectable()
export class PenerimaanService {
  constructor(private db: DatabaseService) {}

  private generateNoPenerimaan(): string {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RC-${ymd}-${rand}`;
  }

  async createPenerimaan(dto: CreatePenerimaanDto): Promise<{ no_penerimaan: string; status: string }> {
    const pembelianRows = await this.db.query<{
      id: number;
      no_pembelian: string;
      status: 'draft' | 'diproses' | 'diterima' | 'dibatalkan';
    }>('SELECT id, no_pembelian, status FROM pembelian WHERE id = ?', [dto.pembelian_id]);
    const pembelian = pembelianRows[0] ?? null;
    if (!pembelian) {
      throw new NotFoundException(`Pembelian dengan id ${dto.pembelian_id} tidak ditemukan`);
    }
    if (pembelian.status !== 'diproses') {
      throw new ConflictException(
        `Penerimaan hanya dapat dibuat untuk pembelian berstatus 'diproses' (status saat ini: ${pembelian.status})`,
      );
    }

    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const [lockRows] = await conn.query<RowDataPacket[]>(
        `SELECT status FROM pembelian WHERE id = ? FOR UPDATE`,
        [dto.pembelian_id],
      );
      const locked = lockRows[0] as { status: string } | undefined;
      if (!locked) {
        throw new NotFoundException(`Pembelian dengan id ${dto.pembelian_id} tidak ditemukan`);
      }
      if (locked.status !== 'diproses') {
        throw new ConflictException(
          `Penerimaan hanya dapat dibuat untuk pembelian berstatus 'diproses' (status saat ini: ${locked.status})`,
        );
      }

      await this.validateItems(conn, dto.pembelian_id, dto.items);

      const noPenerimaan = this.generateNoPenerimaan();
      const [headerResult] = await conn.query(
        `INSERT INTO penerimaan (no_penerimaan, pembelian_id, tanggal) VALUES (?, ?, ?)`,
        [noPenerimaan, dto.pembelian_id, dto.tanggal],
      );
      const penerimaanId = (headerResult as { insertId: number }).insertId;

      for (const item of dto.items) {
        await conn.query(
          `INSERT INTO penerimaan_detail (penerimaan_id, barang_id, qty_terima) VALUES (?, ?, ?)`,
          [penerimaanId, item.barang_id, item.qty_terima],
        );
      }

      await conn.commit();
      return { no_penerimaan: noPenerimaan, status: 'pending' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getPenerimaans(params: { status?: string; pembelianId?: number; page?: number; limit?: number }): Promise<{
    items: { [key: string]: any }[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 10;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.status) {
      if (params.status !== 'pending' && params.status !== 'selesai') {
        throw new BadRequestException('Filter status harus: pending atau selesai');
      }
      conditions.push('r.status = ?');
      values.push(params.status);
    }
    if (params.pembelianId) {
      conditions.push('r.pembelian_id = ?');
      values.push(params.pembelianId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.db.query<{ [key: string]: any }>(
      `SELECT ${PENERIMAAN_COLUMNS}, p.no_pembelian
       FROM penerimaan r
       JOIN pembelian p ON p.id = r.pembelian_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    );

    const countRows = await this.db.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM penerimaan r ${where}`,
      values,
    );

    return {
      items: rows,
      pagination: { page, limit, total: countRows[0].total },
    };
  }

  async getPenerimaan(id: number): Promise<{ [key: string]: any }> {
    const headerRows = await this.db.query<{ [key: string]: any }>(
      `SELECT ${PENERIMAAN_COLUMNS}, p.no_pembelian, p.supplier_id, s.nama AS supplier_nama
       FROM penerimaan r
       JOIN pembelian p ON p.id = r.pembelian_id
       JOIN master_supplier s ON s.id = p.supplier_id
       WHERE r.id = ?`,
      [id],
    );
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Penerimaan dengan id ${id} tidak ditemukan`);
    }

    const items = await this.db.query<{ [key: string]: any }>(
      `SELECT ${PENERIMAAN_DETAIL_COLUMNS}, b.kode AS barang_kode, b.nama AS barang_nama, b.satuan
       FROM penerimaan_detail rd
       JOIN master_barang b ON b.id = rd.barang_id
       WHERE rd.penerimaan_id = ?
       ORDER BY rd.id ASC`,
      [id],
    );

    return {
      ...header,
      supplier: { id: header.supplier_id, nama: header.supplier_nama },
      supplier_id: undefined,
      supplier_nama: undefined,
      items,
    };
  }

  async selesaikanPenerimaan(id: number): Promise<{ no_penerimaan: string; status: string }> {
    const headerRows = await this.db.query<{
      id: number;
      no_penerimaan: string;
      pembelian_id: number;
      status: 'pending' | 'selesai';
    }>('SELECT id, no_penerimaan, pembelian_id, status FROM penerimaan WHERE id = ?', [id]);
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Penerimaan dengan id ${id} tidak ditemukan`);
    }
    if (header.status === 'selesai') {
      throw new ConflictException(
        `Penerimaan '${header.no_penerimaan}' sudah berstatus 'selesai' dan tidak dapat diproses ulang`,
      );
    }

    const items = await this.db.query<{ barang_id: number; qty_terima: number }>(
      'SELECT barang_id, qty_terima FROM penerimaan_detail WHERE penerimaan_id = ?',
      [id],
    );

    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      for (const item of items) {
        await conn.query(
          'UPDATE master_barang SET stok = stok + ? WHERE id = ?',
          [item.qty_terima, item.barang_id],
        );
      }

      await conn.query("UPDATE penerimaan SET status = 'selesai' WHERE id = ?", [id]);

      const incomplete = await this.db.query<{ sisa: number }>(
        `SELECT pd.barang_id,
                pd.qty - COALESCE(SUM(pdet.qty_terima), 0) AS sisa
         FROM pembelian_detail pd
         LEFT JOIN penerimaan_detail pdet ON pdet.barang_id = pd.barang_id
         LEFT JOIN penerimaan r ON r.id = pdet.penerimaan_id AND r.pembelian_id = pd.pembelian_id
         WHERE pd.pembelian_id = ?
         GROUP BY pd.id, pd.barang_id, pd.qty
         HAVING sisa > 0`,
        [header.pembelian_id],
      );

      if (incomplete.length === 0) {
        await conn.query("UPDATE pembelian SET status = 'diterima' WHERE id = ?", [
          header.pembelian_id,
        ]);
      }

      await conn.commit();
      return { no_penerimaan: header.no_penerimaan, status: 'selesai' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async removePenerimaan(id: number): Promise<{ message: string }> {
    const headerRows = await this.db.query<{
      id: number;
      no_penerimaan: string;
      status: 'pending' | 'selesai';
    }>('SELECT id, no_penerimaan, status FROM penerimaan WHERE id = ?', [id]);
    const header = headerRows[0] ?? null;
    if (!header) {
      throw new NotFoundException(`Penerimaan dengan id ${id} tidak ditemukan`);
    }
    if (header.status === 'selesai') {
      throw new ConflictException(
        `Penerimaan '${header.no_penerimaan}' berstatus 'selesai' tidak dapat dihapus (stok sudah bertambah)`,
      );
    }

    await this.db.getPool().query('DELETE FROM penerimaan WHERE id = ?', [id]);
    return { message: `Penerimaan '${header.no_penerimaan}' berhasil dihapus` };
  }

  private async validateItems(
    conn: PoolConnection,
    pembelianId: number,
    items: { barang_id: number; qty_terima: number }[],
  ): Promise<void> {
    const barangIds = items.map((i) => i.barang_id);
    if (new Set(barangIds).size !== barangIds.length) {
      throw new BadRequestException('Terdapat barang duplikat di dalam items');
    }

    const placeholders = barangIds.map(() => '?').join(', ');
    const [poRows] = await conn.query<RowDataPacket[]>(
      `SELECT pd.barang_id, pd.qty,
              COALESCE((
                SELECT SUM(pdet.qty_terima)
                FROM penerimaan_detail pdet
                JOIN penerimaan r ON r.id = pdet.penerimaan_id
                WHERE r.pembelian_id = ? AND pdet.barang_id = pd.barang_id
              ), 0) AS sudah_diterima,
              b.nama AS barang_nama
       FROM pembelian_detail pd
       JOIN master_barang b ON b.id = pd.barang_id
       WHERE pd.pembelian_id = ? AND pd.barang_id IN (${placeholders})`,
      [pembelianId, pembelianId, ...barangIds],
    );
    const poItems = poRows as {
      barang_id: number;
      qty: number;
      sudah_diterima: number;
      barang_nama: string;
    }[];

    if (poItems.length !== barangIds.length) {
      throw new BadRequestException(
        'Terdapat barang yang tidak ada di dalam pembelian ini. Penerimaan hanya boleh berisi barang dari PO terkait',
      );
    }

    const poMap = new Map(poItems.map((p) => [p.barang_id, p]));
    for (const item of items) {
      const po = poMap.get(item.barang_id)!;
      const sisa = Number(po.qty) - Number(po.sudah_diterima);
      if (item.qty_terima > sisa) {
        throw new BadRequestException(
          `Qty terima untuk '${po.barang_nama}' melebihi sisa PO (sisa: ${sisa})`,
        );
      }
    }
  }
}
