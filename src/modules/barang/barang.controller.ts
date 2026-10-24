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
import { BarangService } from './barang.service.js';
import { CreateBarangDto } from './dto/create-barang.dto.js';
import { UpdateBarangDto } from './dto/update-barang.dto.js';

@Controller({ path: 'barang', version: '1' })
export class BarangController {
  constructor(private barangService: BarangService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateBarangDto) {
    return {
      data: await this.barangService.createBarang(dto),
      message: 'Berhasil Membuat Barang',
    };
  }

  @Get()
  @HttpCode(200)
  getBarangs(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.barangService.getBarangs({
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @HttpCode(200)
  getBarang(@Param('id', ParseIntPipe) id: number) {
    return this.barangService.getBarang(id);
  }

  @Patch(':id')
  @HttpCode(200)
  updateBarang(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBarangDto) {
    return this.barangService.updateBarang(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  removeBarang(@Param('id', ParseIntPipe) id: number) {
    return this.barangService.removeBarang(id);
  }
}
