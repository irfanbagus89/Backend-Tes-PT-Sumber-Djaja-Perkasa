import {
  IsArray,
  IsDateString,
  IsInt,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PenerimaanItemDto {
  @Type(() => Number)
  @IsInt({ message: 'barang_id harus berupa angka bulat' })
  barang_id: number;

  @Type(() => Number)
  @IsInt({ message: 'qty_terima harus berupa angka bulat' })
  @Min(1, { message: 'qty_terima minimal 1' })
  qty_terima: number;
}

export class CreatePenerimaanDto {
  @Type(() => Number)
  @IsInt({ message: 'pembelian_id harus berupa angka bulat' })
  pembelian_id: number;

  @IsDateString({}, { message: 'Format tanggal tidak valid (gunakan YYYY-MM-DD)' })
  tanggal: string;

  @IsArray({ message: 'items harus berupa array' })
  @ArrayMinSize(1, { message: 'Minimal 1 item barang' })
  @ValidateNested({ each: true })
  @Type(() => PenerimaanItemDto)
  items: PenerimaanItemDto[];
}
