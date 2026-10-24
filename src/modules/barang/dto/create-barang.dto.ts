import {
  IsString,
  MaxLength,
  IsNotEmpty,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBarangDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama barang wajib diisi' })
  @MaxLength(150, { message: 'Nama barang maksimal 150 karakter' })
  nama: string;

  @IsString()
  @IsNotEmpty({ message: 'Satuan wajib diisi' })
  @MaxLength(30, { message: 'Satuan maksimal 30 karakter' })
  satuan: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Harga beli harus berupa angka' })
  @Min(0, { message: 'Harga beli tidak boleh negatif' })
  harga_beli: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Harga jual harus berupa angka' })
  @Min(0, { message: 'Harga jual tidak boleh negatif' })
  harga_jual: number;
}
