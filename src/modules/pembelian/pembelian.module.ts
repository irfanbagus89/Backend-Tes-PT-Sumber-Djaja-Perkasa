import { Module } from '@nestjs/common';
import { PembelianController } from './pembelian.controller.js';
import { PembelianService } from './pembelian.service.js';

@Module({
  controllers: [PembelianController],
  providers: [PembelianService],
})
export class PembelianModule {}
