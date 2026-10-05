import * as dotenv from 'dotenv';

dotenv.config();

/** Central config — environment-driven, 12-factor style. */
export const config = {
  baseURL: process.env.BASE_URL ?? 'https://the-internet.herokuapp.com',
  apiBaseURL: process.env.API_BASE_URL ?? 'https://jsonplaceholder.typicode.com',
  aiApiKey: process.env.POWERBASE_AI_API_KEY ?? '',
} as const;
