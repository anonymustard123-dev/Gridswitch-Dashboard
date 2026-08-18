# GridSwitch Prospecting Dashboard

An intentionally simple internal dashboard for ranking physical facilities as microgrid prospects. It works immediately in **Demo Data** mode with 35 deterministic Pennsylvania facilities.

## Evidence-first prospecting

The dashboard starts with DataForSEO Business Listings to discover facilities by geography and category. A listing is not treated as a confirmed microgrid opportunity. Use **Verify public records** (or **Verify top 25**) to compare Pennsylvania prospects against EPA Facility Registry System (FRS) records and Pennsylvania DEP eFACTS facility records. An `E-GGRT` program flag is retained where EPA FRS returns one.

The resulting Evidence Tier is deterministic and explainable. It is not an electricity-use estimate. Regrid parcel fields are deliberately excluded from this tier and are optional supplemental research only.

Building-footprint evidence is stored separately (`building_footprint_sqft`). The app never treats parcel area as building area. To populate it at scale, preprocess an open/licensed footprint dataset for Pennsylvania and load only vetted facility matches into Supabase; do not query a multi-gigabyte footprint source from a Vercel request.

## Local setup

1. Copy `.env.example` to `.env.local`. Leave it empty to use demo data; set `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to display the interactive Mapbox map.
2. Run `npm install`, then `npm run dev`.
3. For Supabase, create a project and run `supabase/migrations/202608170001_create_prospects.sql` in its SQL editor. In **Integrations → Data API**, copy the API URL ending in `/rest/v1` into `SUPABASE_DATA_API_URL`, then add the publishable and secret keys.

## Vercel deployment

Import the GitHub repository into Vercel. Add the environment variables listed in `.env.example` for Production, Preview, and Development as appropriate. No build configuration is needed: Vercel detects Next.js and runs `npm run build`.

## Switching to live providers

Add `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` to activate the DataForSEO Business Listings provider. Add `REGRID_API_TOKEN` to activate parcel enrichment. Their values stay exclusively in server route handlers. Add the Supabase Data API URL and secret key to persist live imports. Without those credentials, the route handlers remain safely in demo mode.

## Design notes

The GridSwitch Opportunity Score is deterministic: 65% building-area size score and 35% facility-type energy factor. It is a preliminary prioritization heuristic, never an electricity-consumption estimate.

Run `supabase/migrations/202608180001_add_public_evidence.sql` after the initial migration to add the EPA/PA DEP verification fields and evidence-tier indexes.
