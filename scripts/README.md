# Scripts

- `check-env.mjs` validates local and Netlify environment configuration.
- `clean-build-state.mjs` removes stale Next.js build state before a build.
- `gen-icons.mjs` regenerates the current Out Of Sight icon bundle.

Aircraft ingestion and cleanup are handled by Netlify Functions and Supabase,
not local backfill scripts.
