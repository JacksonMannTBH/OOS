// Apply the narrow nationwide change to a downloaded deployment without
// replacing unrelated live fixes with older local bundles.
import {readFile,writeFile} from 'node:fs/promises';
const [slug,input,output]=process.argv.slice(2);
if(!['oos-ingest','oos-app','oos-api','oos-notifications'].includes(slug)||!input||!output)throw new Error('Usage: node scripts/expand-deployed-state-coverage.mjs SLUG INPUT OUTPUT');
let source=await readFile(input,'utf8');
function replaceOnce(before,after){if(source.split(before).length!==2)throw new Error(`Deployment baseline changed: ${before.slice(0,80)}`);source=source.replace(before,after);}
if(slug==='oos-api'){
 replaceOnce('if (state !== "WA" && state !== "CA" && state !== "TX") return json({ error: "Supported states: WA, CA, TX" }, 400);','if (!APP_STATES.some((entry) => entry.code === state)) return json({ error: "Invalid state" }, 400);');
 replaceOnce('.in("home_state_code", ["WA", "CA", "TX"])','.in("home_state_code", APP_STATES.map((state) => state.code))');
 replaceOnce('states: ["WA", "CA", "TX"],','states: APP_STATES.map((state) => state.code),');
}else{
 replaceOnce('var APP_STATES = ALL_STATES.filter((state) => state.code === "WA" || state.code === "CA" || state.code === "TX");','var APP_STATES = ALL_STATES;');
}
if(slug==='oos-ingest'){
 if(!source.includes('opendata.adsb.fi')||source.includes('api.adsb.lol'))throw new Error('Expected ADSB.fi-only worker');
 replaceOnce(`const result = await db.from("aircraft_catalog_public").select("*").in("home_state_code", SUPPORTED_STATE_CODES).order("tail").limit(1e3);
    if (result.error) throw new Error(result.error.message);
    if (!result.data.length || result.data.length >= 1e3) throw new Error("Unexpected supported-state catalog size");
    const catalog = result.data.map((row) => ({`, `const rows = await readAllCatalogPages((from, to) => db.from("aircraft_catalog_public").select("*").in("home_state_code", SUPPORTED_STATE_CODES).order("tail").range(from, to), "Ingestion catalog read failed");
    if (!rows.length) throw new Error("Supported-state catalog is empty");
    const catalog = rows.map((row) => ({`);
}
await writeFile(output,source);
console.log(`Prepared ${slug}; nationwide state coverage${slug==='oos-ingest'?' and catalog pagination':''}.`);
