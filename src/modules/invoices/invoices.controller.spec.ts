import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoiceLifecycleService, ProcessedDocument } from 'nestjs-fiscal-bridge';

const mockResult: ProcessedDocument = {
  xml: '<xml/>',
  signedXml: '<signed/>',
  pdf: Buffer.from('pdf'),
  deliveryResponse: { success: true, statusCode: '00', statusMessage: 'Procesado' },
};

const mockLifecycle = {
  issueInvoice: jest.fn().mockResolvedValue(mockResult),
  issueCreditNote: jest.fn().mockResolvedValue(mockResult),
  issueDebitNote: jest.fn().mockResolvedValue(mockResult),
};

describe('InvoicesController', () => {
  let controller: InvoicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        { provide: InvoiceLifecycleService, useValue: mockLifecycle },
      ],
    }).compile();

    controller = module.get<InvoicesController>(InvoicesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('issueInvoice', () => {
    it('delegates to InvoiceLifecycleService and returns a DocumentResponseDto', async () => {
      const dto = { id: 'SETP990000001' } as any;
      const result = await controller.issueInvoice(dto, 'CO');

      expect(mockLifecycle.issueInvoice).toHaveBeenCalledWith(dto, 'CO');
      expect(result.success).toBe(true);
      expect(result.documentId).toBe('SETP990000001');
      expect(result.authorityStatusCode).toBe('00');
      expect(result.pdf).toBe(Buffer.from('pdf').toString('base64'));
    });

    it('passes undefined countryCode when header is absent', async () => {
      await controller.issueInvoice({ id: 'X' } as any, undefined);
      expect(mockLifecycle.issueInvoice).toHaveBeenCalledWith(expect.anything(), undefined);
    });
  });

  describe('issueCreditNote', () => {
    it('delegates to InvoiceLifecycleService', async () => {
      const dto = { id: 'NC-001' } as any;
      const result = await controller.issueCreditNote(dto);

      expect(mockLifecycle.issueCreditNote).toHaveBeenCalledWith(dto, undefined);
      expect(result.documentId).toBe('NC-001');
    });
  });

  describe('issueDebitNote', () => {
    it('delegates to InvoiceLifecycleService', async () => {
      const dto = { id: 'ND-001' } as any;
      const result = await controller.issueDebitNote(dto);

      expect(mockLifecycle.issueDebitNote).toHaveBeenCalledWith(dto, undefined);
      expect(result.documentId).toBe('ND-001');
    });
  });
});
