import { IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(['diproses', 'dibatalkan'], {
    message: 'Status tujuan harus salah satu dari: diproses, dibatalkan',
  })
  status: 'diproses' | 'dibatalkan';
}
