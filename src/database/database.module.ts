import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

/**
 * Module untuk koneksi ke MySQL.
 *
 * Menggunakan @Global() agar DatabaseService bisa di-inject ke mana saja
 * tanpa perlu import ulang di setiap module.
 *
 * @example
 * // Cukup import sekali di AppModule
 * @Module({
 *   imports: [DatabaseModule],
 * })
 * export class AppModule {}
 *
 * // Langsung inject di service manapun
 * @Injectable()
 * export class CoffeesService {
 *   constructor(private readonly db: DatabaseService) {}
 * }
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
