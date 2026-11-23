# Phone updates

The owner authorizes phone updates even during an active ride. Do not inspect
or back up ride history, wait for a ride to end, ask the owner to end a ride,
or run ride-data preservation checks as part of installing an update. Install
the requested build normally over the existing app and verify its version and
launch. This preference applies to the update workflow.

# Aircraft supplier

The owner has selected **ADSB.fi** for aircraft ingestion. Do not change the
supplier or enable another supplier as a fallback without an explicit request.
Legacy scheduler, credential, setting, and lease names containing `adsblol` do
not indicate the current supplier. Preserve those identities and the live
schedule when making unrelated delivery or display changes.

Before deploying an ingestion worker, inspect its live source and compare the
supplier with the proposed bundle. Keep the ADSB.fi-only regression check in
`scripts/build-supabase-backend.mjs`.
