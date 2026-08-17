import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
export function adminDb(){if(!serverEnv.NEXT_PUBLIC_SUPABASE_URL || !serverEnv.SUPABASE_SECRET_KEY)return null;return createClient(serverEnv.NEXT_PUBLIC_SUPABASE_URL,serverEnv.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});}
