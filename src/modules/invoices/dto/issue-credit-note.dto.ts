import {
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TaxDetailDto,
  InvoiceItemDto,
  CompanyDto,
  CustomerDto,
  ResolucionDIANDto,
} from './issue-invoice.dto';

export class IssueCreditNoteDto {
  @IsString()
  id: string;

  @IsString()
  issueDate: string;

  @IsString()
  issueTime: string;

  @IsString()
  currency: string;

  @IsString()
  discrepancyCode: string;

  @IsString()
  discrepancyReason: string;

  /** ID de la factura que se está corrigiendo. */
  @IsString()
  billingReference: string;

  /** CUFE de la factura que se está corrigiendo. */
  @IsString()
  billingReferenceCufe: string;

  @ValidateNested()
  @Type(() => ResolucionDIANDto)
  resolution: ResolucionDIANDto;

  @ValidateNested()
  @Type(() => CompanyDto)
  supplier: CompanyDto;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDetailDto)
  taxes: TaxDetailDto[];

  @IsNumber()
  @Min(0)
  subtotal: number;

  @IsNumber()
  @Min(0)
  discounts: number;

  @IsNumber()
  @Min(0)
  taxTotal: number;

  @IsNumber()
  @Min(0)
  total: number;

  @IsString()
  paymentMethod: string;
}
