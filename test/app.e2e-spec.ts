import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter';
import { InvoiceLifecycleService, ProcessedDocument } from 'nestjs-fiscal-bridge';

const mockDoc: ProcessedDocument = {
  xml: '<xml/>',
  signedXml: '<signed/>',
  pdf: Buffer.from('pdf'),
  deliveryResponse: { success: true, statusCode: '00', statusMessage: 'Procesado' },
};

const mockLifecycle = {
  issueInvoice: jest.fn().mockResolvedValue(mockDoc),
  issueCreditNote: jest.fn().mockResolvedValue(mockDoc),
  issueDebitNote: jest.fn().mockResolvedValue(mockDoc),
};

// Minimal valid payload for a Colombia invoice
const validInvoicePayload = {
  id: 'SETP990000001',
  issueDate: '2025-03-06',
  issueTime: '10:00:00-05:00',
  type: '01',
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
  supplier: {
    nit: '900123456',
    dv: '1',
    name: 'Empresa Ejemplo SAS',
    taxRegime: 'O-13',
    address: 'Carrera 7 # 32-16',
    city: 'Bogotá D.C.',
    cityCode: '11001',
    department: 'Cundinamarca',
    departmentCode: '11',
    email: 'facturacion@empresa.com',
    phone: '6017654321',
  },
  customer: {
    idType: '13',
    idNumber: '800197268',
    dv: '4',
    name: 'Cliente de Prueba SA',
    address: 'Carrera 7 # 32-16',
    cityCode: '11001',
    email: 'cliente@prueba.com',
  },
  items: [
    {
      lineNumber: 1,
      code: 'PROD-001',
      description: 'Servicio de desarrollo',
      quantity: 1,
      unitPrice: 1000000,
      discount: 0,
      taxes: [{ code: '01', name: 'IVA', rate: 19, taxableAmount: 1000000, taxAmount: 190000 }],
      lineTotal: 1000000,
    },
  ],
  taxes: [{ code: '01', name: 'IVA', rate: 19, taxableAmount: 1000000, taxAmount: 190000 }],
  subtotal: 1000000,
  discounts: 0,
  taxTotal: 190000,
  total: 1190000,
  paymentMethod: '10',
};

describe('InvoicesController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(InvoiceLifecycleService)
      .useValue(mockLifecycle)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    jest.clearAllMocks();
  });

  afterEach(() => app.close());

  // ── GET / ─────────────────────────────────────────────────────────────────

  it('GET / returns Hello World!', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  // ── POST /invoices ────────────────────────────────────────────────────────

  describe('POST /invoices', () => {
    it('returns 201 and a DocumentResponseDto on valid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .send(validInvoicePayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.documentId).toBe('SETP990000001');
      expect(res.body.authorityStatusCode).toBe('00');
      expect(typeof res.body.pdf).toBe('string');
    });

    it('passes x-country header to the lifecycle service', async () => {
      await request(app.getHttpServer())
        .post('/invoices')
        .set('x-country', 'CO')
        .send(validInvoicePayload)
        .expect(201);

      expect(mockLifecycle.issueInvoice).toHaveBeenCalledWith(
        expect.anything(),
        'CO',
      );
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .send({ id: 'SETP990000001' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('returns 400 when an unknown field is sent', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .send({ ...validInvoicePayload, unknownField: 'hack' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });

    it('returns 400 when type is not a valid DIANInvoiceType', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices')
        .send({ ...validInvoicePayload, type: 'INVALID' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  // ── POST /invoices/credit-notes ───────────────────────────────────────────

  describe('POST /invoices/credit-notes', () => {
    const creditPayload = {
      ...validInvoicePayload,
      discrepancyCode: '1',
      discrepancyReason: 'Devolución parcial',
      billingReference: 'SETP990000001',
      billingReferenceCufe: 'abc123',
    };
    // Remove invoice-only fields
    const { type: _type, resolution: _res, ...creditBase } = creditPayload;
    const validCreditPayload = { ...creditBase, resolution: validInvoicePayload.resolution };

    it('returns 201 on valid credit note payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/invoices/credit-notes')
        .send(validCreditPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('returns 400 when billingReference is missing', async () => {
      const { billingReference: _, ...incomplete } = validCreditPayload;
      await request(app.getHttpServer())
        .post('/invoices/credit-notes')
        .send(incomplete)
        .expect(400);
    });
  });
});
