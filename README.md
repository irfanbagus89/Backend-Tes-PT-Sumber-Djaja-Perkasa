# Backend — Sistem Pembelian & Penerimaan Barang (Studi Kasus 3)

Aplikasi backend REST API untuk mengelola siklus pembelian barang dari supplier hingga barang masuk gudang: master supplier, master barang, transaksi pembelian (PO), transaksi penerimaan (goods receipt), serta perubahan status dan stok secara otomatis.

Dikerjakan sebagai jawaban **Studi Kasus 3** — detail ketentuan studi kasus ada di [`docs/studi-kasus-3.md`](docs/studi-kasus-3.md).

## Teknologi

| Teknologi | Keterangan |
|---|---|
| Node.js + NestJS 12 (TypeScript) | Framework backend REST API |
| MySQL | Database relasional |
| mysql2 | Driver database (query builder manual, tanpa ORM) |
| class-validator + class-transformer | Validasi DTO di backend |
| Zod | Validasi environment variable |
| Vitest | Testing |
| Git | Version control |

## Ringkasan Fitur

- **Master Supplier** — CRUD supplier dengan kode auto-generate (`SUP-YYYYMMDD-XXXX`), status `aktif`/`nonaktif`, validasi telepon (awalan `0` atau `62`, dinormalisasi ke `0`), statistik ringkas per supplier.
- **Master Barang** — CRUD barang dengan kode auto-generate (`BRG-YYYYMMDD-XXXX`), harga beli/jual, stok. Stok hanya berubah lewat penerimaan.
- **Pembelian (PO)** — header + items dalam 1 transaksi DB, nomor auto `PO-YYYYMMDD-XXXX`, total dihitung sistem, alur status `draft → diproses → diterima` atau `draft → dibatalkan`.
- **Penerimaan** — parsial (1 PO bisa banyak penerimaan), validasi akumulasi qty terima ≤ qty PO dengan row-locking (`SELECT ... FOR UPDATE`) untuk mencegah race condition, stok bertambah otomatis saat penerimaan `selesai`, status PO otomatis jadi `diterima` jika semua item terpenuhi.
- **Response format seragam** `{ Metadata: { code, message }, Data }` via global interceptor + global exception filter.
- **Validasi berlapis**: validasi form di frontend, validasi DTO di backend (whitelist + transform), dan constraint di level database (FK, UNIQUE, CHECK).

## Struktur Database

6 tabel dengan relasi:

```
master_supplier 1 ──── * pembelian 1 ──── * pembelian_detail * ──── 1 master_barang
                         │
                         └── * penerimaan 1 ──── * penerimaan_detail * ──── 1 master_barang
```

| Tabel | Keterangan |
|---|---|
| `master_supplier` | kode (unique), nama, telepon, alamat, status |
| `master_barang` | kode (unique), nama, satuan, harga_beli, harga_jual, stok |
| `pembelian` | no_pembelian (unique), tanggal, supplier_id (FK), status, total |
| `pembelian_detail` | pembelian_id (FK), barang_id (FK), qty, harga, subtotal, UNIQUE(pembelian_id, barang_id) |
| `penerimaan` | no_penerimaan (unique), pembelian_id (FK), tanggal, status |
| `penerimaan_detail` | penerimaan_id (FK), barang_id (FK), qty_terima, UNIQUE(penerimaan_id, barang_id) |

DDL lengkap + seed data ada di migrasi: `src/database/migrations/20261024000001_init_tables.ts` dan `20261024000002_seed_data.ts`.

## Petunjuk Menjalankan

### Prasyarat

- Node.js ≥ 20
- MySQL ≥ 8 yang sudah berjalan

### Langkah

1. **Clone & install dependency**

   ```bash
   git clone <url-repository>
   cd backend_testdjaja
   npm install
   ```

2. **Siapkan environment** — copy `.env.example` menjadi `.env` lalu sesuaikan nilainya:

   ```bash
   cp .env.example .env
   ```

   Isi `.env.example`:

   ```env
   # Port server NestJS
   PORT=3000

   # Environment (development | production)
   NODE_ENV=development

   # Database MySQL
   DATABASE_HOST=
   DATABASE_PORT=
   DATABASE_NAME=
   DATABASE_USER=
   DATABASE_PASSWORD=
   ```

3. **Buat database & jalankan migrasi** (membuat 6 tabel + seed data otomatis):

   ```bash
   npm run migrate
   ```

4. **Jalankan aplikasi**

   ```bash
   # development (watch mode)
   npm run start:dev

   # production
   npm run build
   npm run start:prod
   ```

5. API siap diakses di `http://localhost:3000/api/v1`

### Menjalankan Test

```bash
npm run test        # unit test (vitest)
npm run test:e2e    # e2e test
```

## Endpoint API

Base URL: `/api/v1` — semua response dibungkus `{ Metadata: { code, message }, Data }`.

### Master Supplier
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/supplier` | List, `?search=` (kode/nama), `?status=`, `?page=&limit=` |
| GET | `/supplier/:id` | Detail + statistik (jumlah PO, total belanja) |
| POST | `/supplier` | Create (kode digenerate otomatis) |
| PATCH | `/supplier/:id` | Update nama/telepon/alamat/status |
| DELETE | `/supplier/:id` | Ditolak (409) jika sudah dipakai di pembelian |

### Master Barang
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/barang` | List, `?search=`, `?page=&limit=` |
| GET | `/barang/:id` | Detail |
| POST | `/barang` | Create (kode digenerate otomatis) |
| PATCH | `/barang/:id` | Update nama/satuan/harga |
| DELETE | `/barang/:id` | Ditolak (409) jika dipakai transaksi |

### Pembelian (PO)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/pembelian` | List, `?status=`, `?search=`, `?supplierId=`, pagination |
| GET | `/pembelian/:id` | Detail header + supplier + items + qty diterima per item |
| POST | `/pembelian` | Create header+items (transaction), status awal `draft` |
| PATCH | `/pembelian/:id` | Edit (hanya `draft`), replace items |
| PATCH | `/pembelian/:id/status` | Ubah status (`draft→diproses`, `draft→dibatalkan`) |
| DELETE | `/pembelian/:id` | Delete (hanya `draft`) |

### Penerimaan
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/penerimaan` | List, `?status=`, `?pembelianId=` |
| GET | `/penerimaan/:id` | Detail + items |
| POST | `/penerimaan` | Create untuk PO `diproses`, validasi sisa PO |
| PATCH | `/penerimaan/:id/selesai` | Selesaikan → stok bertambah (transaction) |
| DELETE | `/penerimaan/:id` | Delete (hanya `pending`) |

## Struktur Kode

```
src/
├── common/
│   ├── filters/http-exception.filter.ts   # format error seragam
│   └── interceptors/response.interceptor.ts
├── database/
│   ├── database.module.ts
│   ├── database.service.ts                # pool mysql2 + helper query/transaction
│   ├── migrate.ts                         # migration runner
│   └── migrations/                        # DDL + seed
├── modules/
│   ├── supplier/                          # module + controller + service + dto
│   ├── barang/
│   ├── pembelian/
│   └── penerimaan/
├── app.module.ts
└── main.ts                                # bootstrap: CORS, versioning, global pipes
```

## Catatan Desain

- **Tanpa ORM** — query SQL ditulis manual via `mysql2/promise` dengan parameterized query untuk mencegah SQL injection.
- **Kode auto-generate** — kode supplier/barang/nomor transaksi digenerate backend (`PREFIX-YYYYMMDD-XXXX` dengan random hex via `crypto`), tidak diambil dari frontend.
- **Race condition** — validasi sisa PO penerimaan dilakukan di dalam transaksi dengan `SELECT ... FOR UPDATE` pada header pembelian, sehingga dua penerimaan bersamaan untuk PO yang sama tidak bisa overshipment.
- **Integritas stok** — penambahan stok, update status penerimaan, dan update status pembelian dilakukan dalam satu transaksi database.
