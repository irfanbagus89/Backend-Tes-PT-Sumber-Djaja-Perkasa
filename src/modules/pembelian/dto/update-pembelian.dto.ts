import { PartialType } from '@nestjs/mapped-types';
import { CreatePembelianDto, PembelianItemDto } from './create-pembelian.dto.js';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePembelianDto extends PartialType(CreatePembelianDto) {
  @IsArray({ message: 'items harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal 1 item barang' })
  @ValidateNested({ each: true })
  @Type(() => PembelianItemDto)
  items: PembelianItemDto[];
}
