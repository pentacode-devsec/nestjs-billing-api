import 'dotenv/config';
import { UBLInvoiceGenerator } from '../src/fiscal/colombia/ubl/invoice.generator';
import { XMLValidator } from '../src/fiscal/colombia/ubl/xml-validator';
import {
  Company,
  Invoice,
  InvoiceType,
  TaxCode,
} from '../src/fiscal/core/entities/invoice.entity';
import { CertificateLoader } from '../src/fiscal/colombia/signature/certificate.loader';
import { XadesSigner } from '../src/fiscal/colombia/signature/xades.signer';
import { DianClientService } from '../src/fiscal/colombia/dian/dian-client.service';
import { ConfigService } from '@nestjs/config';
import * as empresaEmisoraJson from './empresa-emisora.json';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const generator = new UBLInvoiceGenerator();
  const validator = new XMLValidator();
  const certLoader = new CertificateLoader();
  const signer = new XadesSigner();

  const invoice: Invoice = {
    id: 'SETP990000001',
    issueDate: '2025-03-05',
    issueTime: '10:00:00-05:00',
    type: InvoiceType.FACTURA_VENTA,
    currency: 'COP',
    resolution: {
      number: '18760000001',
      startDate: '2019-01-19',
      endDate: '2030-01-19',
      prefix: 'SETP',
      rangeFrom: 990000000,
      rangeTo: 995000000,
      technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
    },
    supplier: empresaEmisoraJson as Company,
    customer: {
      idType: '13',
      idNumber: '800197268',
      dv: '4',
      name: 'Cliente de Prueba SA',
      address: 'Carrera 7 # 32-16',
      cityCode: '11001',
      email: 'cliente@prueba.com',
    },
    paymentMethod: '10',
    items: [
      {
        lineNumber: 1,
        code: 'PROD-001',
        description: 'Servicio de desarrollo de software',
        quantity: 1,
        unitPrice: 1000000,
        discount: 0,
        taxes: [
          {
            code: TaxCode.IVA,
            name: 'IVA',
            rate: 19,
            taxableAmount: 1000000,
            taxAmount: 190000,
          },
        ],
        lineTotal: 1000000,
      },
    ],
    taxes: [
      {
        code: TaxCode.IVA,
        name: 'IVA',
        rate: 19,
        taxableAmount: 1000000,
        taxAmount: 190000,
      },
    ],
    subtotal: 1000000,
    discounts: 0,
    taxTotal: 190000,
    total: 1190000,
  };

  console.log('Generando XML...');
  const xml = generator.generate(invoice);

  writeFileSync('test-data/factura-prueba.xml', xml);
  console.log('XML guardado en test-data/factura-prueba.xml');

  console.log('Validando contra XSD...');
  const result = validator.validateInvoice(xml);

  if (result.valid) {
    console.log('✅ XML válido — listo para la semana 2');
  } else {
    console.log('❌ Errores de validación:');
    result.errors.forEach((e) => console.log('  -', e));
  }

  // PASO 4 — Cargar certificado
  console.log('\n--- PASO 4: Cargar certificado ---');
  const certPath = join(process.cwd(), 'test-data', 'certs', 'certificado-prueba.p12');
  const certData = certLoader.loadFromP12(certPath, 'pentacode123');
  const certInfo = certLoader.getCertificateInfo(certData);
  console.log('Certificado cargado:');
  console.log('  Subject:', certInfo.subject);
  console.log('  Válido hasta:', certInfo.validTo);

  // PASO 5 — Firmar XML
  console.log('\n--- PASO 5: Firmar XML ---');
  const signedXml = signer.sign(xml, certData);
  writeFileSync('test-data/factura-firmada.xml', signedXml);
  console.log('✅ XML firmado guardado en test-data/factura-firmada.xml');

  // PASO 6 — Enviar a la DIAN
  console.log('\n--- PASO 6: Enviar a la DIAN ---');

  // Simulamos el ConfigService leyendo directo del .env
  const config = {
    get: (key: string) => {
      const map: Record<string, string> = {
        'dian.url': process.env.DIAN_URL ?? '',
        'dian.softwareId': process.env.DIAN_SOFTWARE_ID ?? '',
        'dian.softwarePin': process.env.DIAN_SOFTWARE_PIN ?? '',
        'dian.nit': process.env.DIAN_NIT ?? '',
        'dian.certPath': process.env.CERT_PATH ?? '',
        'dian.certPassword': process.env.CERT_PASSWORD ?? '',
      };
      return map[key];
    },
  } as unknown as ConfigService;

  const dianClient = new DianClientService(config);
  const response = await dianClient.sendTestSet(
    signedXml,
    process.env.DIAN_SOFTWARE_ID ?? '',
  );

  console.log('Respuesta DIAN:');
  console.log('  Status:', response.statusCode);
  console.log('  Mensaje:', response.statusMessage);
  console.log('  Éxito:', response.success);

  if (response.xmlResponse) {
    console.log('  Respuesta completa:', response.xmlResponse);
  }
}

main().catch(console.error);
