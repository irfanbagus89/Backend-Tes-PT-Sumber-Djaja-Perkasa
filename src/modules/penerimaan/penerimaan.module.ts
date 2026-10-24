import { Module } from '@nestjs/common';
import { PenerimaanController } from './penerimaan.controller.js';
import { PenerimaanService } from './penerimaan.service.js';

@Module({
  controllers: [PenerimaanController],
  providers: [PenerimaanService],
})
export class PenerimaanModule {}
