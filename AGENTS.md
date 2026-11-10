# Aircraft supplier

The owner has selected **ADSB.fi** for aircraft ingestion. Do not change the
supplier or enable another supplier as a fallback without an explicit request.
Legacy scheduler, credential, setting, and lease names containing `adsblol` do
not indicate the current supplier. Preserve those identities and the live
schedule when making unrelated delivery or display changes.

Before deploying an ingestion worker, inspect its live source and compare the
supplier with the proposed bundle. Keep the ADSB.fi-only regression check in
`scripts/build-supabase-backend.mjs`.
