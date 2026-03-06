import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  ValidateNested,
  IsEnum,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DIANInvoiceType } from 'nestjs-fiscal-bridge';

export class TaxDetailDto {
  @ApiProperty({
    example: '01',
    description: 'Código DIAN del impuesto (IVA=01, INC=04, etc.)',
  })
  @IsString()
  code: string;

  @ApiProperty({ example: 'IVA' })
  @IsString()
  name: string;

  @ApiProperty({ example: 19 })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiProperty({ example: 1000000 })
  @IsNumber()
  @Min(0)
  taxableAmount: number;

  @ApiProperty({ example: 190000 })
  @IsNumber()
  @Min(0)
  taxAmount: number;
}

export class InvoiceItemDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  lineNumber: number;

  @ApiProperty({ example: 'PROD-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Servicio de desarrollo de software' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 1000000 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  discount: number;

  @ApiProperty({ type: [TaxDetailDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDetailDto)
  taxes: TaxDetailDto[];

  @ApiProperty({ example: 1000000 })
  @IsNumber()
  @Min(0)
  lineTotal: number;
}

export class CompanyDto {
  @ApiProperty({ example: '900123456' })
  @IsString()
  nit: string;

  @ApiProperty({ example: '1' })
  @IsString()
  dv: string;

  @ApiProperty({ example: 'Empresa Ejemplo SAS' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'O-13',
    description: 'Código del régimen tributario (listado 48 DIAN)',
  })
  @IsString()
  taxRegime: string;

  @ApiProperty({ example: 'Carrera 7 # 32-16' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Bogotá D.C.' })
  @IsString()
  city: string;

  @ApiProperty({ example: '11001' })
  @IsString()
  cityCode: string;

  @ApiProperty({ example: 'Cundinamarca' })
  @IsString()
  department: string;

  @ApiProperty({ example: '11' })
  @IsString()
  departmentCode: string;

  @ApiProperty({ example: 'facturacion@empresa.com' })
  @IsString()
  email: string;

  @ApiProperty({ example: '6017654321' })
  @IsString()
  phone: string;
}

export class CustomerDto {
  @ApiProperty({
    example: '13',
    description: 'Tipo de documento (13=cédula, 31=NIT, etc.)',
  })
  @IsString()
  idType: string;

  @ApiProperty({ example: '800197268' })
  @IsString()
  idNumber: string;

  @ApiPropertyOptional({ example: '4' })
  @IsOptional()
  @IsString()
  dv?: string;

  @ApiProperty({ example: 'Cliente de Prueba SA' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Carrera 7 # 32-16' })
  @IsString()
  address: string;

  @ApiProperty({ example: '11001' })
  @IsString()
  cityCode: string;

  @ApiProperty({ example: 'cliente@prueba.com' })
  @IsString()
  email: string;
}

export class ResolucionDIANDto {
  @ApiProperty({ example: '18760000001' })
  @IsString()
  number: string;

  @ApiProperty({ example: '2019-01-19' })
  @IsString()
  startDate: string;

  @ApiProperty({ example: '2030-01-19' })
  @IsString()
  endDate: string;

  @ApiProperty({ example: 'SETP' })
  @IsString()
  prefix: string;

  @ApiProperty({ example: 990000000 })
  @IsNumber()
  rangeFrom: number;

  @ApiProperty({ example: 995000000 })
  @IsNumber()
  rangeTo: number;

  @ApiProperty({ example: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c' })
  @IsString()
  technicalKey: string;
}

export class IssueInvoiceDto {
  @ApiProperty({ example: 'SETP990000001' })
  @IsString()
  id: string;

  @ApiProperty({ example: '2025-03-06' })
  @IsString()
  issueDate: string;

  @ApiProperty({ example: '10:00:00-05:00' })
  @IsString()
  issueTime: string;

  @ApiProperty({
    enum: DIANInvoiceType,
    example: DIANInvoiceType.FACTURA_VENTA,
  })
  @IsEnum(DIANInvoiceType)
  type: DIANInvoiceType;

  @ApiProperty({ example: 'COP' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ example: 'Pago contado' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: ResolucionDIANDto })
  @ValidateNested()
  @Type(() => ResolucionDIANDto)
  resolution: ResolucionDIANDto;

  @ApiProperty({ type: CompanyDto })
  @ValidateNested()
  @Type(() => CompanyDto)
  supplier: CompanyDto;

  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ApiProperty({ type: [InvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({ type: [TaxDetailDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxDetailDto)
  taxes: TaxDetailDto[];

  @ApiProperty({ example: 1000000 })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  discounts: number;

  @ApiProperty({ example: 190000 })
  @IsNumber()
  @Min(0)
  taxTotal: number;

  @ApiProperty({ example: 1190000 })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({ example: '10', description: '10=contado, 20=crédito' })
  @IsString()
  paymentMethod: string;
}
