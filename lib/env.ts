import { z } from 'zod';
const schema=z.object({SUPABASE_DATA_API_URL:z.string().url().optional(),NEXT_PUBLIC_SUPABASE_URL:z.string().url().optional(),NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:z.string().optional(),SUPABASE_SECRET_KEY:z.string().optional(),DATAFORSEO_LOGIN:z.string().optional(),DATAFORSEO_PASSWORD:z.string().optional(),REGRID_API_TOKEN:z.string().optional(),OPENAI_API_KEY:z.string().min(20).optional(),OPENAI_MODEL:z.string().default('gpt-5.4-mini')});
export const serverEnv=schema.parse(process.env);
export const liveDataForSeo=!!(serverEnv.DATAFORSEO_LOGIN && serverEnv.DATAFORSEO_PASSWORD);
export const liveRegrid=!!serverEnv.REGRID_API_TOKEN;
