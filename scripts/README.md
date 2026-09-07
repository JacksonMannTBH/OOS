# Scripts

- `check-env.mjs` validates local and Netlify environment configuration.
- `clean-build-state.mjs` removes stale Next.js build state before a build.
- `gen-icons.mjs` regenerates the current Out Of Sight icon bundle.
- `generate-national-aircraft.py` creates the national catalog and source audit
  from a downloaded FAA registry archive and reviewed overrides.
- `generate-national-aircraft-migration.ts` fills a CLI-created migration with
  the new states, aircraft and available performance profiles. See the
  [coverage guide](../docs/national-aircraft-coverage.md) for the full workflow.

Aircraft ingestion and cleanup are handled by Netlify Functions and Supabase,
not local backfill scripts.
