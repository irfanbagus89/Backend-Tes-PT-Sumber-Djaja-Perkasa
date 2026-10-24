import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { SupplierModule } from './modules/supplier/supplier.module.js';
import { BarangModule } from './modules/barang/barang.module.js';
import { PembelianModule } from './modules/pembelian/pembelian.module.js';
import { PenerimaanModule } from './modules/penerimaan/penerimaan.module.js';
import { z } from 'zod';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: z.object({
        PORT: z.coerce.number().default(3000),
        NODE_ENV: z
          .enum(['development', 'test', 'production'])
          .default('development'),
        DATABASE_HOST: z.string().min(1),
        DATABASE_PORT: z.coerce.number().default(3306),
        DATABASE_NAME: z.string().min(1),
        DATABASE_USER: z.string().min(1),
        DATABASE_PASSWORD: z.string(),
        CORS_ORIGINS: z.string().default('http://localhost:5173'),
      }),
    }),
    DatabaseModule,
    SupplierModule,
    BarangModule,
    PembelianModule,
    PenerimaanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
