import { PartialType } from '@nestjs/mapped-types';
import { CreateBarangDto } from './create-barang.dto.js';

export class UpdateBarangDto extends PartialType(CreateBarangDto) {}
