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
import { PembelianService } from './pembelian.service.js';
import { CreatePembelianDto } from './dto/create-pembelian.dto.js';
import { UpdatePembelianDto } from './dto/update-pembelian.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@Controller({ path: 'pembelian', version: '1' })
export class PembelianController {
  constructor(private pembelianService: PembelianService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreatePembelianDto) {
    return {
      data: await this.pembelianService.createPembelian(dto),
      message: 'Berhasil Membuat Pembelian',
    };
  }

  @Get()
  @HttpCode(200)
  getPembelians(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pembelianService.getPembelians({
      status,
      search,
      supplierId: supplierId ? parseInt(supplierId, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @HttpCode(200)
  getPembelian(@Param('id', ParseIntPipe) id: number) {
    return this.pembelianService.getPembelian(id);
  }

  @Patch(':id')
  @HttpCode(200)
  updatePembelian(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePembelianDto) {
    return this.pembelianService.updatePembelian(id, dto);
  }

  @Patch(':id/status')
  @HttpCode(200)
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatusDto) {
    return this.pembelianService.updatePembelianStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(200)
  removePembelian(@Param('id', ParseIntPipe) id: number) {
    return this.pembelianService.removePembelian(id);
  }
}
