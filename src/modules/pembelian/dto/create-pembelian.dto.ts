import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PembelianItemDto {
  @Type(() => Number)
  @IsInt({ message: 'barang_id harus berupa angka bulat' })
  barang_id: number;

  @Type(() => Number)
  @IsInt({ message: 'qty harus berupa angka bulat' })
  @Min(1, { message: 'qty minimal 1' })
  qty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'harga harus berupa angka' })
  @Min(0, { message: 'harga tidak boleh negatif' })
  harga?: number;
}

export class CreatePembelianDto {
  @Type(() => Number)
  @IsInt({ message: 'supplier_id harus berupa angka bulat' })
  supplier_id: number;

  @IsDateString({}, { message: 'Format tanggal tidak valid (gunakan YYYY-MM-DD)' })
  tanggal: string;

  @IsArray({ message: 'items harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal 1 item barang' })
  @ValidateNested({ each: true })
  @Type(() => PembelianItemDto)
  items: PembelianItemDto[];
}
