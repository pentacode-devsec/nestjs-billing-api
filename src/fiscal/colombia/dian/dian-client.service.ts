import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as soap from 'soap';
import * as forge from 'node-forge';
import { CertificateLoader } from '../signature/certificate.loader';
import { withRetry } from './retry.helper';

export interface DianResponse {
  success: boolean;
  statusCode: string;
  statusMessage: string;
  xmlResponse?: string;
}

interface DianSoapResult {
  SendBillSyncResult?: DianResultBody;
  GetStatusResult?: DianResultBody;
  SendTestSetAsyncResult?: DianResultBody;
  StatusCode?: string;
  statusCode?: string;
  StatusMessage?: string;
  statusMessage?: string;
}

interface DianResultBody {
  StatusCode?: string;
  statusCode?: string;
  StatusMessage?: string;
  statusMessage?: string;
}

interface DianSoapClient extends soap.Client {
  SendBillSyncAsync(req: Record<string, unknown>): Promise<[DianSoapResult]>;
  GetStatusAsync(req: Record<string, unknown>): Promise<[DianSoapResult]>;
  SendTestSetAsyncAsync(
    req: Record<string, unknown>,
  ): Promise<[DianSoapResult]>;
}

@Injectable()
export class DianClientService {
  private readonly url: string;
  private readonly softwareId: string;
  private readonly softwarePin: string;
  private readonly nit: string;
  private readonly certPath: string;
  private readonly certPassword: string;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('dian.url') ?? '';
    this.softwareId = this.config.get<string>('dian.softwareId') ?? '';
    this.softwarePin = this.config.get<string>('dian.softwarePin') ?? '';
    this.nit = this.config.get<string>('dian.nit') ?? '';
    this.certPath = this.config.get<string>('dian.certPath') ?? '';
    this.certPassword = this.config.get<string>('dian.certPassword') ?? '';
  }

  async sendInvoice(signedXml: string): Promise<DianResponse> {
    return withRetry(
      () => this.doSendInvoice(signedXml),
      { maxAttempts: 3, delayMs: 2000, factor: 2 },
      (attempt, error) => {
        console.log(
          `  Intento ${attempt} fallido: ${error.message}. Reintentando...`,
        );
      },
    );
  }

  private async doSendInvoice(signedXml: string): Promise<DianResponse> {
    const xmlBase64 = Buffer.from(signedXml, 'utf8').toString('base64');
    const xmlHash = this.calculateHash(signedXml);
    const client = await soap.createClientAsync(this.url);

    const request = {
      fileName: `fv${Date.now()}.xml`,
      contentFile: xmlBase64,
      trackId: xmlHash,
    };

    const [result] = await client.SendBillSyncAsync(request);
    return this.parseResponse(result);
  }

  async getStatus(trackId: string): Promise<DianResponse> {
    try {
      const client = await this.createAuthenticatedClient();
      const request = { trackId };

      console.log('Consultando estado en la DIAN...');
      const [result] = await client.GetStatusAsync(request);

      return this.parseResponse(result);
    } catch (error) {
      return {
        success: false,
        statusCode: 'ERROR',
        statusMessage: this.extractSoapError(error),
      };
    }
  }

  async sendTestSet(
    signedXml: string,
    testSetId: string,
  ): Promise<DianResponse> {
    return withRetry(
      () => this.doSendTestSet(signedXml, testSetId),
      { maxAttempts: 3, delayMs: 2000, factor: 2 },
      (attempt, error) => {
        console.log(
          `  Intento ${attempt} fallido: ${error.message}. Reintentando...`,
        );
      },
    );
  }

  async doSendTestSet(
    signedXml: string,
    testSetId: string,
  ): Promise<DianResponse> {
    try {
      const xmlBase64 = Buffer.from(signedXml, 'utf8').toString('base64');
      const client = await this.createAuthenticatedClient();

      const request = {
        fileName: `fv${Date.now()}.xml`,
        contentFile: xmlBase64,
        testSetId,
      };

      console.log('Enviando documento al set de pruebas DIAN...');
      const [result] = await client.SendTestSetAsyncAsync(request);

      return this.parseResponse(result);
    } catch (error) {
      return {
        success: false,
        statusCode: 'ERROR',
        statusMessage: this.extractSoapError(error),
      };
    }
  }

  private async createAuthenticatedClient(): Promise<DianSoapClient> {
    const client = (await soap.createClientAsync(this.url, {
      forceSoap12Headers: true,
    })) as DianSoapClient;

    // Cargar certificado y extraer claves en PEM para WS-Security
    const certLoader = new CertificateLoader();
    const certData = certLoader.loadFromP12(this.certPath, this.certPassword);
    const privateKeyPem = forge.pki.privateKeyToPem(certData.privateKey);

    const wsSecurity = new soap.WSSecurityCert(
      privateKeyPem,
      certData.certPem,
      '',
      { hasTimeStamp: false },
    );
    client.setSecurity(wsSecurity);

    return client;
  }

  private extractSoapError(error: unknown): string {
    // Error estándar de JS (SOAP 1.1)
    if (error instanceof Error) {
      const soapErr = error as Error & {
        response?: { status?: number; statusText?: string };
        body?: string;
      };
      const parts: string[] = [error.message];
      const httpStatus = soapErr.response?.status;
      if (httpStatus !== undefined) {
        const statusText = soapErr.response?.statusText ?? '';
        parts.push(`HTTP ${httpStatus}${statusText ? ` ${statusText}` : ''}`);
        if ([502, 503, 504].includes(httpStatus)) {
          console.warn(
            `[DIAN] Error transitorio HTTP ${httpStatus} — el documento debe reintentarse más tarde`,
          );
        }
      }
      if (soapErr.body) parts.push(`Body: ${soapErr.body.substring(0, 300)}`);
      return parts.join(' | ');
    }

    // Objeto de SOAP fault (SOAP 1.2): { Fault, response, body }
    if (error !== null && typeof error === 'object') {
      const fault = error as {
        Fault?: unknown;
        body?: string;
        response?: { status?: number };
      };
      const parts: string[] = [];
      const faultStatus = fault.response?.status;
      if (faultStatus !== undefined && [502, 503, 504].includes(faultStatus)) {
        console.warn(
          `[DIAN] Error transitorio HTTP ${faultStatus} — el documento debe reintentarse más tarde`,
        );
      }
      if (fault.body) parts.push(fault.body.substring(0, 300));
      return parts.length > 0 ? parts.join(' | ') : 'SOAP fault sin detalle';
    }

    return `Error desconocido: ${String(error)}`;
  }

  private calculateHash(content: string): string {
    const md = forge.md.sha256.create();
    md.update(content, 'utf8');
    return md.digest().toHex();
  }

  private parseResponse(result: DianSoapResult): DianResponse {
    if (!result) {
      return {
        success: false,
        statusCode: 'EMPTY',
        statusMessage: 'La DIAN no devolvió respuesta',
      };
    }

    // La DIAN devuelve la respuesta dentro del Result correspondiente
    const response: DianResultBody =
      result.SendBillSyncResult ??
      result.GetStatusResult ??
      result.SendTestSetAsyncResult ??
      result;

    const statusCode =
      response?.StatusCode ?? response?.statusCode ?? 'UNKNOWN';
    const statusMessage =
      response?.StatusMessage ?? response?.statusMessage ?? 'Sin mensaje';

    // Código 00 = procesado correctamente
    // Código 66 = documento procesado con notificación
    const success = ['00', '66'].includes(statusCode);

    return {
      success,
      statusCode,
      statusMessage,
      xmlResponse: JSON.stringify(response, null, 2),
    };
  }
}
