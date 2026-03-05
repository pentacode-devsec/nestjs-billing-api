import { readFileSync } from 'fs';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const libxml = require('libxmljs2') as typeof import('libxmljs2');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class XMLValidator {
  private xsdPath = join(process.cwd(), 'xsd', 'maindoc');

  validateInvoice(xml: string): ValidationResult {
    return this.validate(xml, 'UBL-Invoice-2.1.xsd');
  }

  validateCreditNote(xml: string): ValidationResult {
    return this.validate(xml, 'UBL-CreditNote-2.1.xsd');
  }

  validateDebitNote(xml: string): ValidationResult {
    return this.validate(xml, 'UBL-DebitNote-2.1.xsd');
  }

  private validate(xml: string, xsdFile: string): ValidationResult {
    try {
      const xsdFullPath = join(this.xsdPath, xsdFile);
      const xsdContent = readFileSync(xsdFullPath, 'utf-8');
      const xmlDoc = libxml.parseXml(xml);
      const xsdDoc = libxml.parseXml(xsdContent, { baseUrl: xsdFullPath });
      const valid = xmlDoc.validate(xsdDoc);
      const errors = xmlDoc.validationErrors.map((e) => e.message.trim());
      return { valid, errors };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, errors: [message] };
    }
  }
}
