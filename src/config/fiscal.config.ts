import { registerAs } from '@nestjs/config';

export default registerAs('fiscal', () => ({
  country: process.env.FISCAL_COUNTRY ?? 'CO',
}));
