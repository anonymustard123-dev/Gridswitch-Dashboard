import { z } from 'zod';
const schema=z.object({NEXT_PUBLIC_SUPABASE_URL:z.string().url().optional(),NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:z.string().optional(),SUPABASE_SECRET_KEY:z.string().optional(),DATAFORSEO_LOGIN:z.string().optional(),DATAFORSEO_PASSWORD:z.string().optional(),REGRID_API_TOKEN:z.string().optional()});
export const serverEnv=schema.parse(process.env);
export const liveDataForSeo=!!(serverEnv.DATAFORSEO_LOGIN && serverEnv.DATAFORSEO_PASSWORD);
export const liveRegrid=!!serverEnv.REGRID_API_TOKEN;
