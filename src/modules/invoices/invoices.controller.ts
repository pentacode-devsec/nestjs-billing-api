import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiHeader,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  InvoiceLifecycleService,
  ColombiaInvoice,
  CreditNote,
  DebitNote,
  DeliveryResult,
} from 'nestjs-fiscal-bridge';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { IssueCreditNoteDto } from './dto/issue-credit-note.dto';
import { IssueDebitNoteDto } from './dto/issue-debit-note.dto';
import { DocumentResponseDto } from './dto/document-response.dto';

@ApiTags('invoices')
@ApiHeader({
  name: 'x-country',
  description: 'Código ISO 3166-1 alpha-2 del país (ej. CO, MX). Opcional: usa FISCAL_COUNTRY del entorno cuando se omite.',
  required: false,
  example: 'CO',
})
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly lifecycle: InvoiceLifecycleService) {}

  @ApiOperation({ summary: 'Emitir factura electrónica' })
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiNotFoundResponse({ description: 'Procesador no registrado para el país indicado' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async issueInvoice(
    @Body() dto: IssueInvoiceDto,
    @Headers('x-country') countryCode?: string,
  ): Promise<DocumentResponseDto> {
    const invoice = dto as unknown as ColombiaInvoice;
    const result = await this.lifecycle.issueInvoice(invoice, countryCode);
    return this.toResponse(dto.id, result.pdf, result.deliveryResponse);
  }

  @ApiOperation({ summary: 'Emitir nota crédito electrónica' })
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @Post('credit-notes')
  @HttpCode(HttpStatus.CREATED)
  async issueCreditNote(
    @Body() dto: IssueCreditNoteDto,
    @Headers('x-country') countryCode?: string,
  ): Promise<DocumentResponseDto> {
    const note = dto as unknown as CreditNote;
    const result = await this.lifecycle.issueCreditNote(note, countryCode);
    return this.toResponse(dto.id, result.pdf, result.deliveryResponse);
  }

  @ApiOperation({ summary: 'Emitir nota débito electrónica' })
  @ApiCreatedResponse({ type: DocumentResponseDto })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @Post('debit-notes')
  @HttpCode(HttpStatus.CREATED)
  async issueDebitNote(
    @Body() dto: IssueDebitNoteDto,
    @Headers('x-country') countryCode?: string,
  ): Promise<DocumentResponseDto> {
    const note = dto as unknown as DebitNote;
    const result = await this.lifecycle.issueDebitNote(note, countryCode);
    return this.toResponse(dto.id, result.pdf, result.deliveryResponse);
  }

  private toResponse(
    documentId: string,
    pdf: Buffer,
    deliveryResponse: unknown,
  ): DocumentResponseDto {
    const dr = deliveryResponse as DeliveryResult | undefined;
    return {
      success: dr?.success ?? false,
      documentId,
      authorityStatusCode: dr?.statusCode ?? 'UNKNOWN',
      authorityMessage: dr?.statusMessage ?? '',
      pdf: pdf?.length ? pdf.toString('base64') : '',
    };
  }
}
