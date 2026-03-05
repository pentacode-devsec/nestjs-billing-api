import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import {
  Invoice,
  InvoiceItem,
  TaxDetail,
} from '../../core/entities/invoice.entity';
import { CufeCalculator } from '../signature/cufe.calculator';

export class UBLInvoiceGenerator {
  generate(invoice: Invoice): string {
    // Calcular CUFE antes de generar el XML
    const cufeCalculator = new CufeCalculator();
    invoice.cufe = cufeCalculator.calculate(invoice, '2'); // '2' = habilitación
    console.log('CUFE calculado:', invoice.cufe);

    const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ext':
        'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    });

    // Cabecera
    doc.ele('cbc:UBLVersionID').txt('UBL 2.1').up();
    doc.ele('cbc:CustomizationID').txt('10').up();
    doc.ele('cbc:ProfileID').txt('DIAN 2.1').up();
    doc.ele('cbc:ProfileExecutionID').txt('2').up();
    doc.ele('cbc:ID').txt(invoice.id).up();
    doc
      .ele('cbc:UUID', {
        schemeID: '2',
        schemeName: 'CUFE-SHA384',
      })
      .txt(invoice.cufe ?? '')
      .up();
    doc.ele('cbc:IssueDate').txt(invoice.issueDate).up();
    doc.ele('cbc:IssueTime').txt(invoice.issueTime).up();
    doc.ele('cbc:InvoiceTypeCode').txt(invoice.type).up();
    doc.ele('cbc:DocumentCurrencyCode').txt(invoice.currency).up();
    doc.ele('cbc:LineCountNumeric').txt(String(invoice.items.length)).up();

    // Resolución
    this.addResolution(doc, invoice);

    // Emisor
    this.addSupplier(doc, invoice);

    // Receptor
    this.addCustomer(doc, invoice);

    // Pago
    this.addPaymentMeans(doc, invoice);

    // Impuestos totales
    this.addTaxTotals(doc, invoice);

    // Totales monetarios
    this.addLegalMonetaryTotal(doc, invoice);

    // Líneas de detalle
    invoice.items.forEach((item) =>
      this.addInvoiceLine(doc, item, invoice.currency),
    );

    return doc.end({ prettyPrint: true });
  }

  private addResolution(doc: XMLBuilder, invoice: Invoice): void {
    const res = invoice.resolution;

    doc
      .ele('cac:InvoicePeriod')
      .ele('cbc:StartDate')
      .txt(res.startDate)
      .up()
      .ele('cbc:EndDate')
      .txt(res.endDate)
      .up()
      .up();

    doc
      .ele('cac:OrderReference')
      .ele('cbc:ID')
      .txt(res.number)
      .up()
      .ele('cbc:IssueDate')
      .txt(res.startDate)
      .up()
      .up();
  }

  private addSupplier(doc: XMLBuilder, invoice: Invoice): void {
    const s = invoice.supplier;

    doc
      .ele('cac:AccountingSupplierParty')
      .ele('cbc:AdditionalAccountID')
      .txt('1')
      .up()
      .ele('cac:Party')
      .ele('cac:PartyName')
      .ele('cbc:Name')
      .txt(s.name)
      .up()
      .up()
      .ele('cac:PhysicalLocation')
      .ele('cac:Address')
      .ele('cbc:ID')
      .txt(s.cityCode)
      .up()
      .ele('cbc:CityName')
      .txt(s.city)
      .up()
      .ele('cbc:CountrySubentity')
      .txt(s.department)
      .up()
      .ele('cbc:CountrySubentityCode')
      .txt(s.departmentCode)
      .up()
      .ele('cac:AddressLine')
      .ele('cbc:Line')
      .txt(s.address)
      .up()
      .up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode')
      .txt('CO')
      .up()
      .ele('cbc:Name', { languageID: 'es' })
      .txt('Colombia')
      .up()
      .up()
      .up()
      .up()
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName')
      .txt(s.name)
      .up()
      .ele('cbc:CompanyID', {
        schemeAgencyID: '195',
        schemeAgencyName:
          'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
        schemeID: s.dv,
        schemeName: '31',
      })
      .txt(s.nit)
      .up()
      .ele('cbc:TaxLevelCode', { listName: '48' })
      .txt(s.taxRegime)
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('01')
      .up()
      .ele('cbc:Name')
      .txt('IVA')
      .up()
      .up()
      .up()
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName')
      .txt(s.name)
      .up()
      .ele('cbc:CompanyID', {
        schemeAgencyID: '195',
        schemeID: s.dv,
        schemeName: '31',
      })
      .txt(s.nit)
      .up()
      .up()
      .ele('cac:Contact')
      .ele('cbc:ElectronicMail')
      .txt(s.email)
      .up()
      .up()
      .up()
      .up();
  }

  private addCustomer(doc: XMLBuilder, invoice: Invoice): void {
    const c = invoice.customer;

    doc
      .ele('cac:AccountingCustomerParty')
      .ele('cbc:AdditionalAccountID')
      .txt('1')
      .up()
      .ele('cac:Party')
      .ele('cac:PartyIdentification')
      .ele('cbc:ID', { schemeID: c.idType })
      .txt(c.idNumber)
      .up()
      .up()
      .ele('cac:PartyName')
      .ele('cbc:Name')
      .txt(c.name)
      .up()
      .up()
      .ele('cac:PhysicalLocation')
      .ele('cac:Address')
      .ele('cbc:ID')
      .txt(c.cityCode)
      .up()
      .ele('cac:AddressLine')
      .ele('cbc:Line')
      .txt(c.address)
      .up()
      .up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode')
      .txt('CO')
      .up()
      .up()
      .up()
      .up()
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName')
      .txt(c.name)
      .up()
      .ele('cbc:CompanyID', {
        schemeAgencyID: '195',
        schemeID: c.dv ?? '0',
        schemeName: c.idType,
      })
      .txt(c.idNumber)
      .up()
      .ele('cbc:TaxLevelCode', { listName: '48' })
      .txt('R-99-PN')
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('ZZ')
      .up()
      .ele('cbc:Name')
      .txt('No aplica')
      .up()
      .up()
      .up()
      .ele('cac:Contact')
      .ele('cbc:ElectronicMail')
      .txt(c.email)
      .up()
      .up()
      .up()
      .up();
  }

  private addPaymentMeans(doc: XMLBuilder, invoice: Invoice): void {
    doc
      .ele('cac:PaymentMeans')
      .ele('cbc:ID')
      .txt(invoice.paymentMethod)
      .up()
      .ele('cbc:PaymentMeansCode')
      .txt(invoice.paymentMethod)
      .up()
      .ele('cbc:PaymentDueDate')
      .txt(invoice.issueDate)
      .up()
      .up();
  }

  private addTaxTotals(doc: XMLBuilder, invoice: Invoice): void {
    invoice.taxes.forEach((tax: TaxDetail) => {
      doc
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: invoice.currency })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: invoice.currency })
        .txt(tax.taxableAmount.toFixed(2))
        .up()
        .ele('cbc:TaxAmount', { currencyID: invoice.currency })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent')
        .txt(String(tax.rate))
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt(tax.code)
        .up()
        .ele('cbc:Name')
        .txt(tax.name)
        .up()
        .up()
        .up()
        .up()
        .up();
    });
  }

  private addLegalMonetaryTotal(doc: XMLBuilder, invoice: Invoice): void {
    doc
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: invoice.currency })
      .txt(invoice.subtotal.toFixed(2))
      .up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: invoice.currency })
      .txt(invoice.subtotal.toFixed(2))
      .up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: invoice.currency })
      .txt(invoice.total.toFixed(2))
      .up()
      .ele('cbc:AllowanceTotalAmount', { currencyID: invoice.currency })
      .txt(invoice.discounts.toFixed(2))
      .up()
      .ele('cbc:PayableAmount', { currencyID: invoice.currency })
      .txt(invoice.total.toFixed(2))
      .up()
      .up();
  }

  private addInvoiceLine(
    doc: XMLBuilder,
    item: InvoiceItem,
    currency: string,
  ): void {
    const line = doc.ele('cac:InvoiceLine');

    line.ele('cbc:ID').txt(String(item.lineNumber)).up();
    line
      .ele('cbc:InvoicedQuantity', { unitCode: 'EA' })
      .txt(String(item.quantity))
      .up();
    line
      .ele('cbc:LineExtensionAmount', { currencyID: currency })
      .txt(item.lineTotal.toFixed(2))
      .up();

    item.taxes.forEach((tax: TaxDetail) => {
      line
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: currency })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: currency })
        .txt(tax.taxableAmount.toFixed(2))
        .up()
        .ele('cbc:TaxAmount', { currencyID: currency })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent')
        .txt(String(tax.rate))
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt(tax.code)
        .up()
        .ele('cbc:Name')
        .txt(tax.name)
        .up()
        .up()
        .up()
        .up()
        .up();
    });

    line
      .ele('cac:Item')
      .ele('cbc:Description')
      .txt(item.description)
      .up()
      .ele('cac:SellersItemIdentification')
      .ele('cbc:ID')
      .txt(item.code)
      .up()
      .up()
      .up();

    line
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: currency })
      .txt(item.unitPrice.toFixed(2))
      .up()
      .ele('cbc:BaseQuantity', { unitCode: 'EA' })
      .txt(String(item.quantity))
      .up()
      .up();
  }
}
