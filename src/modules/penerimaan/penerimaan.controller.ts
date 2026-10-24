import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PenerimaanService } from './penerimaan.service.js';
import { CreatePenerimaanDto } from './dto/create-penerimaan.dto.js';

@Controller({ path: 'penerimaan', version: '1' })
export class PenerimaanController {
  constructor(private penerimaanService: PenerimaanService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreatePenerimaanDto) {
    return {
      data: await this.penerimaanService.createPenerimaan(dto),
      message: 'Berhasil Membuat Penerimaan',
    };
  }

  @Get()
  @HttpCode(200)
  getPenerimaans(
    @Query('status') status?: string,
    @Query('pembelianId') pembelianId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.penerimaanService.getPenerimaans({
      status,
      pembelianId: pembelianId ? parseInt(pembelianId, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @HttpCode(200)
  getPenerimaan(@Param('id', ParseIntPipe) id: number) {
    return this.penerimaanService.getPenerimaan(id);
  }

  @Patch(':id/selesai')
  @HttpCode(200)
  selesaikan(@Param('id', ParseIntPipe) id: number) {
    return this.penerimaanService.selesaikanPenerimaan(id);
  }

  @Delete(':id')
  @HttpCode(200)
  removePenerimaan(@Param('id', ParseIntPipe) id: number) {
    return this.penerimaanService.removePenerimaan(id);
  }
}
