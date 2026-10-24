import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto.js';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @IsOptional()
  @IsEnum(['aktif', 'nonaktif'], {
    message: 'Status harus salah satu dari: aktif, nonaktif',
  })
  status?: 'aktif' | 'nonaktif';
}
