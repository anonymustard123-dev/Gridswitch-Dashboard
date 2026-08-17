import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
/** Converts a Supabase Data API URL such as https://abc.supabase.co/rest/v1 to the client root URL. */
export function projectUrlFromDataApiUrl(dataApiUrl:string){const url=new URL(dataApiUrl);url.pathname=url.pathname.replace(/\/rest\/v1\/?$/,'') || '/';return url.toString().replace(/\/$/,'');}
export function adminDb(){const projectUrl=serverEnv.SUPABASE_DATA_API_URL?projectUrlFromDataApiUrl(serverEnv.SUPABASE_DATA_API_URL):serverEnv.NEXT_PUBLIC_SUPABASE_URL;if(!projectUrl || !serverEnv.SUPABASE_SECRET_KEY)return null;return createClient(projectUrl,serverEnv.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});}
