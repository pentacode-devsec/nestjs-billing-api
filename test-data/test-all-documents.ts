import { ColombianPdfGenerator } from '../src/fiscal/colombia/pdf/colombian-pdf.generator';
import { UBLInvoiceGenerator } from '../src/fiscal/colombia/ubl/invoice.generator';
import { CreditNoteGenerator } from '../src/fiscal/colombia/ubl/credit-note.generator';
import { DebitNoteGenerator } from '../src/fiscal/colombia/ubl/debit-note.generator';
import { XMLValidator } from '../src/fiscal/colombia/ubl/xml-validator';
import { CufeCalculator } from '../src/fiscal/colombia/signature/cufe.calculator';
import { CertificateLoader } from '../src/fiscal/colombia/signature/certificate.loader';
import { XadesSigner } from '../src/fiscal/colombia/signature/xades.signer';
import {
  Invoice,
  InvoiceType,
  TaxCode,
} from '../src/fiscal/core/entities/invoice.entity';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const generator = new UBLInvoiceGenerator();
const creditGen = new CreditNoteGenerator();
const debitGen = new DebitNoteGenerator();
const validator = new XMLValidator();
const cufeCalc = new CufeCalculator();
const certLoader = new CertificateLoader();
const signer = new XadesSigner();
const pdfGenerator = new ColombianPdfGenerator();

const supplier = require('./empresa-emisora.json');
const certPath = join(
  process.cwd(),
  'test-data',
  'certs',
  'certificado-prueba.p12',
);
const certData = certLoader.loadFromP12(certPath, 'pentacode123');

const resolution = {
  number: '18760000001',
  startDate: '2019-01-19',
  endDate: '2030-01-19',
  prefix: 'SETP',
  rangeFrom: 990000000,
  rangeTo: 995000000,
  technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
};

const customer = {
  idType: '13',
  idNumber: '800197268',
  dv: '4',
  name: 'Cliente de Prueba SA',
  address: 'Carrera 7 # 32-16',
  cityCode: '11001',
  email: 'cliente@prueba.com',
};

const baseItems = [
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
];

const baseTaxes = [
  {
    code: TaxCode.IVA,
    name: 'IVA',
    rate: 19,
    taxableAmount: 1000000,
    taxAmount: 190000,
  },
];

async function processDocument(
  name: string,
  xml: string,
  filename: string,
  type: 'invoice' | 'credit' | 'debit',
): Promise<void> {
  console.log(`\n--- ${name} ---`);

  // Validar
  let result;
  if (type === 'invoice') result = await validator.validateInvoice(xml);
  else if (type === 'credit') result = await validator.validateCreditNote(xml);
  else result = await validator.validateDebitNote(xml);

  if (!result.valid) {
    console.log('❌ XML inválido:');
    result.errors.forEach((e) => console.log('  -', e));
    return;
  }
  console.log('✅ XML válido');

  // Firmar
  const signedXml = signer.sign(xml, certData);
  writeFileSync(`test-data/${filename}`, signedXml);
  console.log(`✅ Firmado y guardado en test-data/${filename}`);
}

async function main() {
  console.log('=== Generando todos los documentos del set de pruebas ===\n');

  // ── FACTURA 1 — con IVA ──────────────────────────────────────────────────
  const factura1: Invoice = {
    id: 'SETP990000001',
    issueDate: '2025-03-05',
    issueTime: '10:00:00-05:00',
    type: InvoiceType.FACTURA_VENTA,
    currency: 'COP',
    resolution,
    supplier,
    customer,
    paymentMethod: '10',
    items: baseItems,
    taxes: baseTaxes,
    subtotal: 1000000,
    discounts: 0,
    taxTotal: 190000,
    total: 1190000,
  };
  factura1.cufe = cufeCalc.calculate(factura1, '2');
  await processDocument(
    'Factura 1 — IVA 19%',
    generator.generate(factura1),
    'factura-1.xml',
    'invoice',
  );

  // ── FACTURA 2 — sin IVA ──────────────────────────────────────────────────
  const factura2: any = {
    id: 'SETP990000002',
    issueDate: '2025-03-05',
    issueTime: '10:05:00-05:00',
    type: InvoiceType.FACTURA_VENTA,
    currency: 'COP',
    resolution,
    supplier,
    customer,
    paymentMethod: '10',
    items: [
      {
        lineNumber: 1,
        code: 'PROD-002',
        description: 'Consultoría exenta de IVA',
        quantity: 1,
        unitPrice: 500000,
        discount: 0,
        taxes: [
          {
            code: TaxCode.IVA,
            name: 'IVA',
            rate: 0,
            taxableAmount: 500000,
            taxAmount: 0,
          },
        ],
        lineTotal: 500000,
      },
    ],
    taxes: [
      {
        code: TaxCode.IVA,
        name: 'IVA',
        rate: 0,
        taxableAmount: 500000,
        taxAmount: 0,
      },
    ],
    subtotal: 500000,
    discounts: 0,
    taxTotal: 0,
    total: 500000,
  };
  factura2.cufe = cufeCalc.calculate(factura2, '2');
  await processDocument(
    'Factura 2 — Sin IVA',
    generator.generate(factura2),
    'factura-2.xml',
    'invoice',
  );

  // ── FACTURA 3 — con descuento ────────────────────────────────────────────
  const factura3: any = {
    id: 'SETP990000003',
    issueDate: '2025-03-05',
    issueTime: '10:10:00-05:00',
    type: InvoiceType.FACTURA_VENTA,
    currency: 'COP',
    resolution,
    supplier,
    customer,
    paymentMethod: '10',
    items: [
      {
        lineNumber: 1,
        code: 'PROD-003',
        description: 'Licencia de software con descuento',
        quantity: 1,
        unitPrice: 2000000,
        discount: 200000,
        taxes: [
          {
            code: TaxCode.IVA,
            name: 'IVA',
            rate: 19,
            taxableAmount: 1800000,
            taxAmount: 342000,
          },
        ],
        lineTotal: 1800000,
      },
    ],
    taxes: [
      {
        code: TaxCode.IVA,
        name: 'IVA',
        rate: 19,
        taxableAmount: 1800000,
        taxAmount: 342000,
      },
    ],
    subtotal: 1800000,
    discounts: 200000,
    taxTotal: 342000,
    total: 2142000,
  };
  factura3.cufe = cufeCalc.calculate(factura3, '2');
  await processDocument(
    'Factura 3 — Con descuento',
    generator.generate(factura3),
    'factura-3.xml',
    'invoice',
  );

  // ── FACTURA 4 — múltiples líneas ─────────────────────────────────────────
  const factura4: any = {
    id: 'SETP990000004',
    issueDate: '2025-03-05',
    issueTime: '10:15:00-05:00',
    type: InvoiceType.FACTURA_VENTA,
    currency: 'COP',
    resolution,
    supplier,
    customer,
    paymentMethod: '10',
    items: [
      {
        lineNumber: 1,
        code: 'PROD-001',
        description: 'Servicio de desarrollo',
        quantity: 2,
        unitPrice: 500000,
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
      {
        lineNumber: 2,
        code: 'PROD-004',
        description: 'Soporte técnico mensual',
        quantity: 1,
        unitPrice: 300000,
        discount: 0,
        taxes: [
          {
            code: TaxCode.IVA,
            name: 'IVA',
            rate: 19,
            taxableAmount: 300000,
            taxAmount: 57000,
          },
        ],
        lineTotal: 300000,
      },
    ],
    taxes: [
      {
        code: TaxCode.IVA,
        name: 'IVA',
        rate: 19,
        taxableAmount: 1300000,
        taxAmount: 247000,
      },
    ],
    subtotal: 1300000,
    discounts: 0,
    taxTotal: 247000,
    total: 1547000,
  };
  factura4.cufe = cufeCalc.calculate(factura4, '2');
  await processDocument(
    'Factura 4 — Múltiples líneas',
    generator.generate(factura4),
    'factura-4.xml',
    'invoice',
  );

  // ── FACTURAS 5–8 — variaciones menores ───────────────────────────────────
  for (let i = 5; i <= 8; i++) {
    const factura: any = {
      id: `SETP99000000${i}`,
      issueDate: '2025-03-05',
      issueTime: `10:${i * 5}:00-05:00`,
      type: InvoiceType.FACTURA_VENTA,
      currency: 'COP',
      resolution,
      supplier,
      customer,
      paymentMethod: '10',
      items: [
        {
          lineNumber: 1,
          code: `PROD-00${i}`,
          description: `Servicio de prueba número ${i}`,
          quantity: i,
          unitPrice: 100000,
          discount: 0,
          taxes: [
            {
              code: TaxCode.IVA,
              name: 'IVA',
              rate: 19,
              taxableAmount: i * 100000,
              taxAmount: i * 19000,
            },
          ],
          lineTotal: i * 100000,
        },
      ],
      taxes: [
        {
          code: TaxCode.IVA,
          name: 'IVA',
          rate: 19,
          taxableAmount: i * 100000,
          taxAmount: i * 19000,
        },
      ],
      subtotal: i * 100000,
      discounts: 0,
      taxTotal: i * 19000,
      total: i * 119000,
    };
    factura.cufe = cufeCalc.calculate(factura, '2');
    await processDocument(
      `Factura ${i}`,
      generator.generate(factura),
      `factura-${i}.xml`,
      'invoice',
    );
  }

  // ── NOTA CRÉDITO ─────────────────────────────────────────────────────────
  const notaCredito: any = {
    id: 'SETP990000009',
    issueDate: '2025-03-05',
    issueTime: '11:00:00-05:00',
    currency: 'COP',
    paymentMethod: '10',
    discrepancyCode: '1',
    discrepancyReason: 'Devolución parcial del bien',
    billingReference: factura1.id,
    billingReferenceCufe: factura1.cufe,
    resolution,
    supplier,
    customer,
    items: baseItems,
    taxes: baseTaxes,
    subtotal: 1000000,
    discounts: 0,
    taxTotal: 190000,
    total: 1190000,
  };
  notaCredito.cufe = cufeCalc.calculate(
    { ...notaCredito, type: InvoiceType.NOTA_CREDITO },
    '2',
  );
  await processDocument(
    'Nota Crédito',
    creditGen.generate(notaCredito),
    'nota-credito.xml',
    'credit',
  );

  // ── NOTA DÉBITO ──────────────────────────────────────────────────────────
  const notaDebito: any = {
    id: 'SETP990000010',
    issueDate: '2025-03-05',
    issueTime: '11:30:00-05:00',
    currency: 'COP',
    paymentMethod: '10',
    discrepancyCode: '3',
    discrepancyReason: 'Cargo por intereses de mora',
    billingReference: factura2.id,
    billingReferenceCufe: factura2.cufe,
    resolution,
    supplier,
    customer,
    items: [
      {
        lineNumber: 1,
        code: 'PROD-INT',
        description: 'Intereses de mora',
        quantity: 1,
        unitPrice: 50000,
        discount: 0,
        taxes: [
          {
            code: TaxCode.IVA,
            name: 'IVA',
            rate: 19,
            taxableAmount: 50000,
            taxAmount: 9500,
          },
        ],
        lineTotal: 50000,
      },
    ],
    taxes: [
      {
        code: TaxCode.IVA,
        name: 'IVA',
        rate: 19,
        taxableAmount: 50000,
        taxAmount: 9500,
      },
    ],
    subtotal: 50000,
    discounts: 0,
    taxTotal: 9500,
    total: 59500,
  };
  notaDebito.cufe = cufeCalc.calculate(
    { ...notaDebito, type: InvoiceType.NOTA_DEBITO },
    '2',
  );
  await processDocument(
    'Nota Débito',
    debitGen.generate(notaDebito),
    'nota-debito.xml',
    'debit',
  );

  // ── PDF ──────────────────────────────────────────────────────────────────
  console.log('\n--- Generando PDF ---');
  const pdfBuffer = await pdfGenerator.generate(factura1);
  writeFileSync('test-data/factura-1.pdf', pdfBuffer);
  console.log('✅ PDF generado en test-data/factura-1.pdf');

  console.log('\n=== Resumen ===');
  console.log('✅ 8 facturas generadas y firmadas');
  console.log('✅ 1 nota crédito generada y firmada');
  console.log('✅ 1 nota débito generada y firmada');
  console.log(
    '\nListo para enviar a la DIAN cuando el servicio esté disponible.',
  );
}

main().catch(console.error);
