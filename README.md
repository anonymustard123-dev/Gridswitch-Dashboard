# GridSwitch Prospecting Dashboard

An intentionally simple internal dashboard for ranking physical facilities as microgrid prospects. It works immediately in **Demo Data** mode with 35 deterministic Pennsylvania facilities.

## Local setup

1. Copy `.env.example` to `.env.local`. Leave it empty to use demo data; set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to display the interactive Mapbox map.
2. Run `npm install`, then `npm run dev`.
3. For Supabase, create a project and run `supabase/migrations/202608170001_create_prospects.sql` in its SQL editor. Add the three Supabase variables below.

## Vercel deployment

Import the GitHub repository into Vercel. Add the environment variables listed in `.env.example` for Production, Preview, and Development as appropriate. No build configuration is needed: Vercel detects Next.js and runs `npm run build`.

## Switching to live providers

Add `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` to activate the DataForSEO Business Listings provider. Add `REGRID_API_TOKEN` to activate parcel enrichment. Their values stay exclusively in server route handlers. Add the Supabase URL and secret key to persist live imports. Without those credentials, the route handlers remain safely in demo mode.

## Design notes

The GridSwitch Opportunity Score is deterministic: 65% building-area size score and 35% facility-type energy factor. It is a preliminary prioritization heuristic, never an electricity-consumption estimate.
