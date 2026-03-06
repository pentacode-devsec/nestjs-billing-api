import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ConfigModule } from '@nestjs/config';
import dianConfig from './config/dian.config';
import fiscalConfig from './config/fiscal.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dianConfig, fiscalConfig],
    }),
    InvoicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
