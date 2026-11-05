import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { backendRoot, checkBackend, functions } from './check-aircraft-provider.mjs';

const [name, output] = process.argv.slice(2);
if (!Object.hasOwn(functions, name) || !output) {
  throw new Error('Usage: node scripts/prepare-aircraft-deploy.mjs oos-ingest|oos-app|oos-api|mobile-api OUTPUT_JSON');
}
const git = (...args) => execFileSync('git', args, { cwd: backendRoot, encoding: 'utf8' }).trim();
git('fetch', 'origin', 'main');
git('merge-base', '--is-ancestor', 'origin/main', 'HEAD');
const releasePaths = ['supabase/functions', 'scripts/check-aircraft-provider.mjs', 'scripts/prepare-aircraft-deploy.mjs', 'AGENTS.md'];
if (git('status', '--porcelain', '--', ...releasePaths)) {
  throw new Error('Commit and review all aircraft backend changes before preparing a deployment.');
}
checkBackend();
execFileSync(process.execPath, ['--test', 'supabase/functions/adsbfi.test.mjs'], { cwd: backendRoot, stdio: 'inherit' });
for (const slug of Object.keys(functions)) {
  execFileSync(process.execPath, ['--check', `supabase/functions/${slug}/${slug === 'mobile-api' ? 'bundle.js' : 'index.js'}`], { cwd: backendRoot, stdio: 'inherit' });
}
const entrypoint = name === 'mobile-api' ? 'index.ts' : 'index.js';
const files = (name === 'mobile-api' ? ['index.ts', 'bundle.js', 'deno.json'] : ['index.js'])
  .map(file => ({ name: file, content: readFileSync(path.join(backendRoot, 'supabase/functions', name, file), 'utf8') }));
const payload = {
  project_id: 'ohhixakjamjocgmatbha', name, entrypoint_path: entrypoint,
  ...(name === 'mobile-api' ? { import_map_path: 'deno.json' } : {}),
  verify_jwt: functions[name], files,
};
writeFileSync(output, JSON.stringify(payload), 'utf8');
console.log(`Prepared ${name} from commit ${git('rev-parse', 'HEAD')}. Add the OOS account link_id when submitting to the Supabase deploy tool.`);
