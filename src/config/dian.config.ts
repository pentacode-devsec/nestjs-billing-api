import { registerAs } from '@nestjs/config';

export default registerAs('dian', () => ({
  ambiente: process.env.DIAN_AMBIENTE ?? '2',
  softwareId: process.env.DIAN_SOFTWARE_ID,
  softwarePin: process.env.DIAN_SOFTWARE_PIN,
  url: process.env.DIAN_URL,
  nit: process.env.DIAN_NIT,
  certPath: process.env.CERT_PATH,
  certPassword: process.env.CERT_PASSWORD,
}));
