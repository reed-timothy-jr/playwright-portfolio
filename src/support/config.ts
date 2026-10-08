import * as dotenv from 'dotenv';

dotenv.config();

/** Central config — environment-driven, 12-factor style. */
export const config = {
	aiApiKey: process.env.POWERBASE_AI_API_KEY ?? '',
} as const;
