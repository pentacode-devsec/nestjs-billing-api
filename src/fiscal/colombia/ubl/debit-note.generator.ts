import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import {
  Company,
  Customer,
  InvoiceItem,
  ResolucionDIAN,
  TaxDetail,
} from '../../core/entities/invoice.entity';

export interface DebitNote {
  id: string;
  issueDate: string;
  issueTime: string;
  currency: string;
  discrepancyCode: string;
  discrepancyReason: string;
  billingReference: string;
  billingReferenceCufe: string;
  resolution: ResolucionDIAN;
  supplier: Company;
  customer: Customer;
  items: InvoiceItem[];
  taxes: TaxDetail[];
  subtotal: number;
  discounts: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  cufe?: string;
}

export class DebitNoteGenerator {
  generate(note: DebitNote): string {
    const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('DebitNote', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
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
    doc.ele('cbc:ID').txt(note.id).up();
    doc
      .ele('cbc:UUID', {
        schemeID: '2',
        schemeName: 'CUDE-SHA384',
      })
      .txt(note.cufe ?? '')
      .up();
    doc.ele('cbc:IssueDate').txt(note.issueDate).up();
    doc.ele('cbc:IssueTime').txt(note.issueTime).up();
    doc.ele('cbc:DocumentCurrencyCode').txt(note.currency).up();
    doc.ele('cbc:LineCountNumeric').txt(String(note.items.length)).up();

    // Motivo de la nota débito
    doc
      .ele('cac:DiscrepancyResponse')
      .ele('cbc:ReferenceID')
      .txt(note.billingReference)
      .up()
      .ele('cbc:ResponseCode')
      .txt(note.discrepancyCode)
      .up()
      .ele('cbc:Description')
      .txt(note.discrepancyReason)
      .up()
      .up();

    // Referencia a la factura original
    doc
      .ele('cac:BillingReference')
      .ele('cac:InvoiceDocumentReference')
      .ele('cbc:ID')
      .txt(note.billingReference)
      .up()
      .ele('cbc:UUID', {
        schemeID: '2',
        schemeName: 'CUFE-SHA384',
      })
      .txt(note.billingReferenceCufe)
      .up()
      .ele('cbc:IssueDate')
      .txt(note.issueDate)
      .up()
      .up()
      .up();

    // Emisor
    this.addSupplier(doc, note.supplier);

    // Receptor
    this.addCustomer(doc, note.customer);

    // Pago
    doc
      .ele('cac:PaymentMeans')
      .ele('cbc:ID')
      .txt(note.paymentMethod)
      .up()
      .ele('cbc:PaymentMeansCode')
      .txt(note.paymentMethod)
      .up()
      .ele('cbc:PaymentDueDate')
      .txt(note.issueDate)
      .up()
      .up();

    // Impuestos
    note.taxes.forEach((tax: TaxDetail) => {
      doc
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: note.currency })
        .txt(tax.taxAmount.toFixed(2))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: note.currency })
        .txt(tax.taxableAmount.toFixed(2))
        .up()
        .ele('cbc:TaxAmount', { currencyID: note.currency })
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

    // Totales
    doc
      .ele('cac:RequestedMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: note.currency })
      .txt(note.subtotal.toFixed(2))
      .up()
      .ele('cbc:TaxExclusiveAmount', { currencyID: note.currency })
      .txt(note.subtotal.toFixed(2))
      .up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: note.currency })
      .txt(note.total.toFixed(2))
      .up()
      .ele('cbc:AllowanceTotalAmount', { currencyID: note.currency })
      .txt(note.discounts.toFixed(2))
      .up()
      .ele('cbc:PayableAmount', { currencyID: note.currency })
      .txt(note.total.toFixed(2))
      .up()
      .up();

    // Líneas
    note.items.forEach((item) => {
      this.addDebitNoteLine(doc, item, note.currency);
    });

    return doc.end({ prettyPrint: true });
  }

  private addSupplier(doc: XMLBuilder, s: Company): void {
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

  private addCustomer(doc: XMLBuilder, c: Customer): void {
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

  private addDebitNoteLine(
    doc: XMLBuilder,
    item: InvoiceItem,
    currency: string,
  ): void {
    const line = doc.ele('cac:DebitNoteLine');

    line.ele('cbc:ID').txt(String(item.lineNumber)).up();
    line
      .ele('cbc:DebitedQuantity', { unitCode: 'EA' })
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
