# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Development (watch mode)
pnpm run start:dev

# Build
pnpm run build

# Lint (auto-fix)
pnpm run lint

# Format
pnpm run format

# Unit tests
pnpm run test

# Run a single test file
pnpm run test -- --testPathPattern=<filename>

# Watch tests
pnpm run test:watch

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Architecture Overview

This is a NestJS API for **Colombian electronic invoicing (Factura Electrónica)** compliant with DIAN (Dirección de Impuestos y Aduanas Nacionales) regulations using the UBL 2.1 standard.

### Module Structure

```
src/
  app.module.ts              # Root module — imports InvoicesModule, ConfigModule (global)
  config/dian.config.ts      # DIAN config namespace loaded from env vars
  modules/invoices/          # NestJS module (controller currently empty)
  fiscal/
    core/                    # Domain entities and interfaces (framework-agnostic)
      entities/              # Invoice, InvoiceItem, Company, Customer, TaxDetail, ResolucionDIAN
      interfaces/            # IPdfGenerator, IDocumentSigner, ITaxCalculator, IElectronicDelivery
    colombia/                # Colombia-specific DIAN implementation
      ubl/                   # UBL XML generation and XSD validation
      signature/             # Digital signing (XAdES-BES) and CUFE calculation
      dian/                  # SOAP client for DIAN web services
      pdf/                   # PDF generation (Puppeteer + Handlebars)
```

### Invoice Processing Flow

1. **Build** an `Invoice` object (`src/fiscal/core/entities/invoice.entity.ts`) with supplier, customer, resolution, items, taxes
2. **Generate UBL XML** — `UBLInvoiceGenerator.generate()` also calculates and embeds the CUFE
3. **Validate XML** against UBL XSD schemas (`XMLValidator`) — schemas live in `xsd/maindoc/`
4. **Sign** with XAdES-BES — `XadesSigner.sign()` using a PKCS#12 certificate loaded by `CertificateLoader`
5. **Send to DIAN** via SOAP — `DianClientService.sendInvoice()` (production) or `sendTestSet()` (habilitación); uses exponential-backoff retry (`withRetry`, max 3 attempts)
6. **Generate PDF** — `ColombianPdfGenerator.generate()` renders a Handlebars template via Puppeteer and embeds a QR code

The same UBL/signature/DIAN pipeline applies to credit notes (`CreditNoteGenerator`) and debit notes (`DebitNoteGenerator`).

### Key Domain Concepts

- **CUFE** — Unique invoice code, SHA-384 hash of a concatenated string of invoice fields + technical key + environment code
- **CUDE** — Same concept for credit/debit notes
- **Environments** — `DIANAmbiente.HABILITACION = '2'` (testing), `DIANAmbiente.PRODUCCION = '1'`
- **Tax codes** (`TaxCode` enum) — IVA (`01`), INC (`04`), RETE_IVA (`06`), RETE_ICA (`07`)
- **ProfileExecutionID** — Hardcoded to `'2'` (habilitación) in generators; must match environment

### Environment Variables

```
DIAN_AMBIENTE        # '1' = producción, '2' = habilitación (default)
DIAN_SOFTWARE_ID     # Software ID registered with DIAN
DIAN_SOFTWARE_PIN    # Software PIN
DIAN_URL             # DIAN SOAP endpoint URL
DIAN_NIT             # Issuer NIT
CERT_PATH            # Path to .p12 certificate file
CERT_PASSWORD        # .p12 certificate password
```

### Static Assets

- **XSD schemas** — `xsd/maindoc/UBL-Invoice-2.1.xsd`, `UBL-CreditNote-2.1.xsd`, `UBL-DebitNote-2.1.xsd` (with imports resolved via `baseUrl`)
- **PDF template** — `src/fiscal/colombia/pdf/templates/invoice.template.hbs`
- **Reference docs** — `docs/` contains official DIAN technical annexes and value lists

### Test Data

`test-data/empresa-emisora.json` — sample company (supplier) data for manual testing.
