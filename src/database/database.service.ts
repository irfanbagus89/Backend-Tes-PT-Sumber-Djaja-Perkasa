import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';

/**
 * Service untuk koneksi ke MySQL menggunakan driver mysql2/promise (tanpa ORM).
 *
 * Menggunakan connection pool untuk efisiensi koneksi.
 * Pool config: max 20 koneksi, idle timeout 30 detik, connection timeout 5 detik.
 *
 * @example
 * // Inject ke service lain
 * constructor(private readonly db: DatabaseService) {}
 *
 * // Query biasa
 * const rows = await this.db.query('SELECT * FROM coffees');
 *
 * // Query dengan parameter (SQL injection safe)
 * const rows = await this.db.query('SELECT * FROM coffees WHERE id = ?', [id]);
 *
 * // Transaction
 * const conn = await this.db.getConnection();
 * try {
 *   await conn.beginTransaction();
 *   await conn.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [amount, fromId]);
 *   await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, toId]);
 *   await conn.commit();
 * } catch (err) {
 *   await conn.rollback();
 *   throw err;
 * } finally {
 *   conn.release();
 * }
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    this.pool = mysql.createPool({
      host: this.config.get<string>('DATABASE_HOST'),
      port: this.config.get<number>('DATABASE_PORT'),
      database: this.config.get<string>('DATABASE_NAME'),
      user: this.config.get<string>('DATABASE_USER'),
      password: this.config.get<string>('DATABASE_PASSWORD'),
      waitForConnections: true,
      connectionLimit: 20,
      idleTimeout: 30000,
      enableKeepAlive: true,
    });
  }

  /**
   * Ambil pool koneksi langsung.
   * Gunakan untuk kebutuhan lanjutan (event listener, streaming, dll).
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Jalankan query SQL dengan parameterized query.
   * Method utama untuk SELECT (mengembalikan langsung array of rows).
   *
   * @param sql - SQL query dengan placeholder (?, ?, ...)
   * @param params - Parameter untuk query
   * @returns Array of rows (RowDataPacket)
   *
   * @example
   * const rows = await this.db.query('SELECT * FROM coffees WHERE category = ?', ['latte']);
   */
  async query<T = RowDataPacket>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
    return rows as T[];
  }

  /**
   * Ambil satu koneksi dari pool untuk transaction.
   * Wajib panggil conn.release() setelah selesai (di block finally).
   *
   * @returns PoolConnection untuk transaction
   *
   * @example
   * const conn = await this.db.getConnection();
   * try {
   *   await conn.beginTransaction();
   *   // ... beberapa query
   *   await conn.commit();
   * } catch (err) {
   *   await conn.rollback();
   *   throw err;
   * } finally {
   *   conn.release();
   * }
   */
  async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  /**
   * Tutup semua koneksi di pool saat application berhenti.
   * Dipanggil otomatis oleh NestJS (OnModuleDestroy).
   */
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
