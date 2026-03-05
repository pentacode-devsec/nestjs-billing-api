import * as forge from 'node-forge';
import { CertificateData } from './certificate.loader';

export class XadesSigner {
  sign(xml: string, certData: CertificateData): string {
    const { privateKey, certificate } = certData;

    // 1. Extraer el certificado en base64
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate));
    const certBase64 = forge.util.encode64(certDer.data);

    // 2. Calcular el digest del certificado (SHA-1 para XAdES-BES)
    const certMd = forge.md.sha1.create();
    certMd.update(certDer.data);
    const certDigest = forge.util.encode64(certMd.digest().data);

    // 3. Generar ID únicos para los nodos de firma
    const signatureId = `xmldsig-${this.generateId()}`;
    const signedPropertiesId = `${signatureId}-signedprops`;
    const keyInfoId = `${signatureId}-keyinfo`;
    const referenceId = `${signatureId}-ref0`;

    // 4. Calcular digest del XML original (sin firma)
    const xmlDigest = this.calculateDigest(xml);

    // 5. Obtener fecha y hora actual en formato ISO
    const signingTime = new Date().toISOString();

    // 6. Construir el bloque SignedProperties
    const signedPropertiesXml = this.buildSignedProperties(
      signedPropertiesId,
      signingTime,
      certBase64,
      certDigest,
      certificate,
    );

    // 7. Calcular digest de SignedProperties
    const signedPropertiesDigest = this.calculateDigest(signedPropertiesXml);

    // 8. Construir SignedInfo
    const signedInfo = this.buildSignedInfo(
      signatureId,
      referenceId,
      xmlDigest,
      signedPropertiesId,
      signedPropertiesDigest,
    );

    // 9. Firmar el SignedInfo con la clave privada
    const signedInfoCanonical = this.canonicalize(signedInfo);
    const md = forge.md.sha256.create();
    md.update(signedInfoCanonical, 'utf8');
    const signature = privateKey.sign(md);
    const signatureB64 = forge.util.encode64(signature);

    // 10. Construir el XML final con la firma incrustada
    return this.buildSignedXml(
      xml,
      signatureId,
      signedPropertiesId,
      keyInfoId,
      referenceId,
      signedInfo,
      signatureB64,
      certBase64,
      signedPropertiesXml,
      signedPropertiesDigest,
      xmlDigest,
    );
  }

  private buildSignedProperties(
    id: string,
    signingTime: string,
    certBase64: string,
    certDigest: string,
    certificate: forge.pki.Certificate,
  ): string {
    const serial = certificate.serialNumber;
    const issuer = certificate.issuer.attributes
      .map(
        (a: { shortName: string; value: string }) =>
          `${a.shortName}=${a.value}`,
      )
      .join(',');

    return (
      `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${id}">` +
      `<xades:SignedSignatureProperties>` +
      `<xades:SigningTime>${signingTime}</xades:SigningTime>` +
      `<xades:SigningCertificate>` +
      `<xades:Cert>` +
      `<xades:CertDigest>` +
      `<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
      `<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigest}</ds:DigestValue>` +
      `</xades:CertDigest>` +
      `<xades:IssuerSerial>` +
      `<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${issuer}</ds:X509IssuerName>` +
      `<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serial}</ds:X509SerialNumber>` +
      `</xades:IssuerSerial>` +
      `</xades:Cert>` +
      `</xades:SigningCertificate>` +
      `</xades:SignedSignatureProperties>` +
      `</xades:SignedProperties>`
    );
  }

  private buildSignedInfo(
    signatureId: string,
    referenceId: string,
    xmlDigest: string,
    signedPropertiesId: string,
    signedPropertiesDigest: string,
  ): string {
    return (
      `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">` +
      `<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>` +
      `<ds:Reference Id="${referenceId}" URI="">` +
      `<ds:Transforms>` +
      `<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
      `</ds:Transforms>` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<ds:DigestValue>${xmlDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `<ds:Reference URI="#${signedPropertiesId}" Type="http://uri.etsi.org/01903#SignedProperties">` +
      `<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>` +
      `<ds:DigestValue>${signedPropertiesDigest}</ds:DigestValue>` +
      `</ds:Reference>` +
      `</ds:SignedInfo>`
    );
  }

  private buildSignedXml(
    originalXml: string,
    signatureId: string,
    signedPropertiesId: string,
    keyInfoId: string,
    referenceId: string,
    signedInfo: string,
    signatureB64: string,
    certBase64: string,
    signedPropertiesXml: string,
    signedPropertiesDigest: string,
    xmlDigest: string,
  ): string {
    // Insertar ext:UBLExtensions con la firma justo después del tag de apertura Invoice
    const signatureBlock =
      `<ext:UBLExtensions>` +
      `<ext:UBLExtension>` +
      `<ext:ExtensionContent>` +
      `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="${signatureId}">` +
      signedInfo +
      `<ds:SignatureValue>${signatureB64}</ds:SignatureValue>` +
      `<ds:KeyInfo Id="${keyInfoId}">` +
      `<ds:X509Data>` +
      `<ds:X509Certificate>${certBase64}</ds:X509Certificate>` +
      `</ds:X509Data>` +
      `</ds:KeyInfo>` +
      `<ds:Object>` +
      `<xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="#${signatureId}">` +
      signedPropertiesXml +
      `</xades:QualifyingProperties>` +
      `</ds:Object>` +
      `</ds:Signature>` +
      `</ext:ExtensionContent>` +
      `</ext:UBLExtension>` +
      `</ext:UBLExtensions>`;

    // Insertar después del tag de apertura <Invoice ...>
    const invoiceTagEnd = originalXml.indexOf('>') + 1;
    return (
      originalXml.slice(0, invoiceTagEnd) +
      '\n' +
      signatureBlock +
      originalXml.slice(invoiceTagEnd)
    );
  }

  private calculateDigest(content: string): string {
    const md = forge.md.sha256.create();
    md.update(content, 'utf8');
    return forge.util.encode64(md.digest().data);
  }

  private canonicalize(xml: string): string {
    // Canonicalización básica C14N para el SignedInfo
    return xml.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 11) +
      Math.random().toString(36).substring(2, 11)
    );
  }
}
