import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import QRCode from 'qrcode';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Invoice } from '../../core/entities/invoice.entity';

export class ColombianPdfGenerator {
  private template: Handlebars.TemplateDelegate;

  constructor() {
    this.registerHelpers();
    this.loadTemplate();
  }

  async generate(invoice: Invoice): Promise<Buffer> {
    const qrDataUrl = await this.generateQR(invoice);
    const html = this.template({
      invoice,
      supplier: invoice.supplier,
      customer: invoice.customer,
      resolution: invoice.resolution,
      items: invoice.items,
      paymentMethodLabel: this.getPaymentMethodLabel(invoice.paymentMethod),
      qrDataUrl,
    });

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true,
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async generateQR(invoice: Invoice): Promise<string> {
    // La DIAN define el contenido del QR como la URL de consulta del documento
    const qrContent = [
      `NumFac=${invoice.id}`,
      `FecFac=${invoice.issueDate}`,
      `HorFac=${invoice.issueTime}`,
      `NitFac=${invoice.supplier.nit}`,
      `DocAdq=${invoice.customer.idNumber}`,
      `ValFac=${invoice.subtotal.toFixed(2)}`,
      `ValIva=${invoice.taxTotal.toFixed(2)}`,
      `ValTotFac=${invoice.total.toFixed(2)}`,
      `CUFE=${invoice.cufe}`,
    ].join('&');

    return QRCode.toDataURL(qrContent, {
      width: 200,
      margin: 1,
      color: {
        dark: '#1E3A5F',
        light: '#FFFFFF',
      },
    });
  }

  private loadTemplate(): void {
    const templatePath = join(__dirname, 'templates', 'invoice.template.hbs');
    const source = readFileSync(templatePath, 'utf-8');
    this.template = Handlebars.compile(source);
  }

  private getPaymentMethodLabel(code: string): string {
    const labels: Record<string, string> = {
      '10': 'Contado',
      '20': 'Crédito',
      '42': 'Consignación bancaria',
      '47': 'Transferencia débito bancario',
      '48': 'Tarjeta de crédito',
      '49': 'Tarjeta débito',
      '71': 'Bonos',
      '72': 'Vales',
    };
    return labels[code] ?? code;
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('formatCurrency', (value: number) => {
      if (value === undefined || value === null) return '0,00';
      return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    });

    Handlebars.registerHelper('formatDate', (dateStr: string) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    });

    Handlebars.registerHelper(
      'firstTaxRate',
      (taxes: Array<{ rate: number }>) => {
        if (!taxes || taxes.length === 0) return '0';
        return String(taxes[0].rate);
      },
    );
  }
}
