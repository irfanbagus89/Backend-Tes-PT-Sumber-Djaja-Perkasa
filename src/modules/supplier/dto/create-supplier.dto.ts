import { IsString, MaxLength, IsNotEmpty, Matches } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama supplier wajib diisi' })
  @MaxLength(150, { message: 'Nama supplier maksimal 150 karakter' })
  nama: string;

  @IsString()
  @IsNotEmpty({ message: 'Telepon supplier wajib diisi' })
  @MaxLength(20, { message: 'Telepon maksimal 20 karakter' })
  @Matches(/^(0|62)\d+$/, {
    message: 'Telepon harus diawali dengan 0 atau 62',
  })
  telepon: string;

  @IsString()
  @IsNotEmpty({ message: 'Alamat supplier wajib diisi' })
  @MaxLength(255, { message: 'Alamat maksimal 255 karakter' })
  alamat: string;
}
