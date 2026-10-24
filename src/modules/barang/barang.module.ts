import { Module } from '@nestjs/common';
import { BarangController } from './barang.controller.js';
import { BarangService } from './barang.service.js';

@Module({
  controllers: [BarangController],
  providers: [BarangService],
})
export class BarangModule {}
