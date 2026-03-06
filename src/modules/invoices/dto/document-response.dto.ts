import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Respuesta estándar para cualquier documento fiscal procesado. */
export class DocumentResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'SETP990000001' })
  documentId: string;

  @ApiPropertyOptional({
    example: 'a3f4b2c1...',
    description:
      'CUFE (facturas) o CUDE (notas crédito/débito) calculado por la DIAN.',
  })
  fiscalCode?: string;

  @ApiProperty({
    example: '00',
    description: 'Código de respuesta de la autoridad tributaria.',
  })
  authorityStatusCode: string;

  @ApiProperty({ example: 'Procesado Correctamente.' })
  authorityMessage: string;

  @ApiProperty({ description: 'PDF del documento codificado en base64.' })
  pdf: string;
}
