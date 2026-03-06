import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { FiscalBridgeModule } from 'nestjs-fiscal-bridge';

@Module({
  imports: [FiscalBridgeModule.register({ countries: ['CO', 'MX'] })],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
