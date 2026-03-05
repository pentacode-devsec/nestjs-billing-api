export enum InvoiceType {
  FACTURA_VENTA = '01',
  NOTA_CREDITO = '91',
  NOTA_DEBITO = '92',
}

export enum DIANAmbiente {
  HABILITACION = '2',
  PRODUCCION = '1',
}

export enum TaxCode {
  IVA = '01',
  INC = '04',
  RETE_IVA = '06',
  RETE_ICA = '07',
}

export interface TaxDetail {
  code: TaxCode;
  name: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface InvoiceItem {
  lineNumber: number;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxes: TaxDetail[];
  lineTotal: number;
}

export interface Company {
  nit: string;
  dv: string;
  name: string;
  taxRegime: string;
  address: string;
  city: string;
  cityCode: string;
  department: string;
  departmentCode: string;
  email: string;
  phone: string;
}

export interface Customer {
  idType: string;
  idNumber: string;
  dv?: string;
  name: string;
  address: string;
  cityCode: string;
  email: string;
}

export interface ResolucionDIAN {
  number: string;
  startDate: string;
  endDate: string;
  prefix: string;
  rangeFrom: number;
  rangeTo: number;
  technicalKey: string;
}

export interface Invoice {
  id: string;
  issueDate: string;
  issueTime: string;
  type: InvoiceType;
  currency: string;
  notes?: string;
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
