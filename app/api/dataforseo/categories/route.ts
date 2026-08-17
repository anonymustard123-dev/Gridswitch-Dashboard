import { NextResponse } from 'next/server';import { dataForSeoProvider } from '@/lib/providers/dataforseo';
let cache:string[]|null=null;const keywords=/data center|cold storage|food processing|manufacturer|manufacturing|warehouse|distribution|hospital|hotel|university|shopping mall|industrial/i;
export async function GET(){try{cache ??= (await dataForSeoProvider.categories()).filter(x=>keywords.test(x));return NextResponse.json({categories:cache,demo:cache.length===0});}catch{return NextResponse.json({categories:[],error:'Categories are unavailable.'},{status:502});}}
