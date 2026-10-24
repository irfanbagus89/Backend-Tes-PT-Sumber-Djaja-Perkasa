import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

type Migration = {
  name: string;
  up: (connection: mysql.PoolConnection) => Promise<void>;
};

async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.resolve(import.meta.dirname, 'migrations');
  const files = (await readdir(migrationsDir)).filter((file) =>
    file.endsWith('.ts'),
  );
  files.sort();

  return Promise.all(
    files.map(async (file) => {
      const module = await import(path.join(migrationsDir, file));
      return { name: file, up: module.up as Migration['up'] };
    }),
  );
}

async function main(): Promise<void> {
  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    multipleStatements: true,
  });
  const connection = await pool.getConnection();
  const end = async (): Promise<void> => {
    connection.release();
    await pool.end();
  };

  await connection.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT name FROM migrations',
  );
  const executed = new Set(rows.map((row) => row.name as string));

  const migrations = await loadMigrations();
  const pending = migrations.filter((migration) => !executed.has(migration.name));

  if (pending.length === 0) {
    console.log('Tidak ada migration yang perlu dijalankan.');
    await end();
    return;
  }

  for (const migration of pending) {
    try {
      await connection.beginTransaction();
      await migration.up(connection);
      await connection.query('INSERT INTO migrations (name) VALUES (?)', [
        migration.name,
      ]);
      await connection.commit();
      console.log(`Migration sukses: ${migration.name}`);
    } catch (error) {
      await connection.rollback();
      console.error(`Migration gagal: ${migration.name}`);
      throw error;
    }
  }

  await end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
