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
import { SupplierService } from './supplier.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';

@Controller({ path: 'supplier', version: '1' })
export class SupplierController {
  constructor(private supplierService: SupplierService) {}

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateSupplierDto) {
    return {
      data: await this.supplierService.createSupplier(dto),
      message: 'Berhasil Membuat Supplier',
    };
  }

  @Get()
  @HttpCode(200)
  getSuppliers(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supplierService.getSuppliers({
      search,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @HttpCode(200)
  getSupplier(@Param('id', ParseIntPipe) id: number) {
    return this.supplierService.getSupplier(id);
  }

  @Patch(':id')
  @HttpCode(200)
  updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.supplierService.updateSupplier(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  removeSupplier(@Param('id', ParseIntPipe) id: number) {
    return this.supplierService.removeSupplier(id);
  }
}
