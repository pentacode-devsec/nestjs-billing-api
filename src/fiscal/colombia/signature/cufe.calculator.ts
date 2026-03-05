import { createHash } from 'crypto';
import { Invoice, TaxCode } from '../../core/entities/invoice.entity';

export class CufeCalculator {
  calculate(invoice: Invoice, ambiente: string): string {
    const valFac = this.getSubtotal(invoice);
    const valImp1 = this.getTaxValue(invoice, TaxCode.IVA);
    const valImp2 = this.getTaxValue(invoice, TaxCode.INC);
    const valImp3 = this.getTaxValue(invoice, TaxCode.RETE_ICA);
    const valTot = invoice.total.toFixed(2);

    const chain = [
      invoice.id,
      invoice.issueDate,
      invoice.issueTime,
      valFac,
      TaxCode.IVA,
      valImp1,
      TaxCode.INC,
      valImp2,
      TaxCode.RETE_ICA,
      valImp3,
      valTot,
      invoice.supplier.nit,
      invoice.customer.idNumber,
      invoice.resolution.technicalKey,
      ambiente,
    ].join('');

    return createHash('sha384').update(chain, 'utf8').digest('hex');
  }

  private getSubtotal(invoice: Invoice): string {
    return invoice.subtotal.toFixed(2);
  }

  private getTaxValue(invoice: Invoice, code: TaxCode): string {
    const tax = invoice.taxes.find((t) => t.code === code);
    return tax ? tax.taxAmount.toFixed(2) : '0.00';
  }
}
