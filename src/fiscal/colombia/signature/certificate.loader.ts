import * as forge from 'node-forge';
import { readFileSync } from 'fs';

export interface CertificateData {
  privateKey: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
  certPem: string;
}

export class CertificateLoader {
  loadFromP12(p12Path: string, password: string): CertificateData {
    const p12Buffer = readFileSync(p12Path);
    const p12Der = forge.util.createBuffer(p12Buffer.toString('binary'));
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Extraer clave privada
    const keyBags = p12.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

    if (!keyBag?.key) {
      throw new Error('No se encontró la clave privada en el certificado .p12');
    }

    // Extraer certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag]?.[0];

    if (!certBag?.cert) {
      throw new Error('No se encontró el certificado en el archivo .p12');
    }

    const certPem = forge.pki.certificateToPem(certBag.cert);

    return {
      privateKey: keyBag.key,
      certificate: certBag.cert,
      certPem,
    };
  }

  getCertificateInfo(certData: CertificateData): {
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
  } {
    const cert = certData.certificate;
    return {
      subject:
        (cert.subject.getField('CN') as { value: string } | null)?.value ??
        'Desconocido',
      issuer:
        (cert.issuer.getField('CN') as { value: string } | null)?.value ??
        'Desconocido',
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
    };
  }
}
