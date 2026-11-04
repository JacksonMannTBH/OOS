import Link from "next/link";
import { isAdminAuthed, isAdminPasscodeConfigured } from "@/lib/admin-auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import { LoginForm } from "../LoginForm";
import styles from "./requests.module.css";
import { InstallApp } from "./InstallApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "API requests · Out Of Sight", robots: { index: false, follow: false } };

const statuses = ["succeeded", "failed", "partial", "running", "skipped"] as const;

export default async function RequestsPage({ searchParams }: {
  searchParams: { source?: string; hours?: string; error?: string };
}) {
  if (!isAdminPasscodeConfigured()) return <main className={styles.page}>Configure ADMIN_PASSCODE to view API requests.</main>;
  if (!isAdminAuthed()) return <LoginForm error={searchParams.error} next="requests" />;

  const source = ["adsblol", "adsbfi", "all"].includes(searchParams.source ?? "") ? searchParams.source! : "adsblol";
  const hours = ["1", "24", "168"].includes(searchParams.hours ?? "") ? Number(searchParams.hours) : 24;
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const query = () => {
    let request = getSupabaseAdmin().from("ingestion_runs").select("id,started_at,finished_at,status,source,source_aircraft_count,error").gte("started_at", since);
    if (source !== "all") request = request.ilike("source", `%${source}%`);
    return request;
  };
  let message = "";
  let rows: { id: string; started_at: string; finished_at: string | null; status: string; source: string | null; source_aircraft_count: number; error: string | null }[] = [];
  let counts: number[] = [];
  try {
    if (!isSupabaseConfigured()) throw new Error("Database is not configured.");
    const [recent, ...totals] = await Promise.all([
      query().order("started_at", { ascending: false }).limit(50),
      ...statuses.map(status => {
        let request = getSupabaseAdmin().from("ingestion_runs").select("id", { count: "exact", head: true }).gte("started_at", since).eq("status", status);
        if (source !== "all") request = request.ilike("source", `%${source}%`);
        return request;
      }),
    ]);
    if (recent.error || totals.some(result => result.error)) throw new Error("Could not load request history. Try refreshing.");
    rows = recent.data ?? [];
    counts = totals.map(result => result.count ?? 0);
  } catch (error) {
    message = error instanceof Error ? error.message : "Could not load request history.";
  }
  const [succeeded = 0, failed = 0, partial = 0, running = 0, skipped = 0] = counts;
  const completed = succeeded + failed + partial;
  const rate = completed ? `${(succeeded / completed * 100).toFixed(1)}%` : "—";
  return <main className={styles.page}>
    <header className={styles.header}><div><Link href="/admin" className={styles.back}>← Out Of Sight</Link><h1>API requests<span> / {source === "all" ? "all sources" : source === "adsblol" ? "adsb.lol" : "adsb.fi"}</span></h1></div><Link className={styles.refresh} href={`/admin/requests?source=${source}&hours=${hours}`}>Refresh ↻</Link></header>
    <InstallApp />
    <form className={styles.filters}>
      <label>Source <select name="source" defaultValue={source}><option value="adsblol">adsb.lol</option><option value="adsbfi">adsb.fi</option><option value="all">All sources</option></select></label>
      <label>Period <select name="hours" defaultValue={hours}><option value="1">Last hour</option><option value="24">Last 24 hours</option><option value="168">Last 7 days</option></select></label>
      <button type="submit">Apply</button>
    </form>
    {message && <p role="alert" className={styles.notice}>{message}</p>}<>
      <section className={styles.stats} aria-label="Ingestion run totals">
        <div><span>Succeeded</span><strong className={styles.success}>{message ? "—" : succeeded.toLocaleString()}</strong></div>
        <div><span>Failed</span><strong className={styles.failed}>{message ? "—" : failed.toLocaleString()}</strong></div>
        <div><span>Partial</span><strong>{message ? "—" : partial.toLocaleString()}</strong></div>
        <div><span>Success rate</span><strong>{rate}</strong></div>
      </section>
      <p className={styles.note}>Counts reflect recorded ingestion runs. Partial runs count toward the success-rate denominator. {running} running · {skipped} skipped.</p>
      <section><div className={styles.tableHeading}><h2>Recent runs</h2><span>Latest 50 · times in UTC</span></div>
        <div className={styles.scroll}><table><thead><tr><th>Started</th><th>Result</th><th>Source</th><th>Duration</th><th>Aircraft</th><th>Details</th></tr></thead><tbody>
          {rows.map(row => <tr key={row.id}><td>{new Date(row.started_at).toISOString().replace("T", " ").slice(0, 19)}</td><td><span className={row.status === "succeeded" ? styles.success : row.status === "failed" ? styles.failed : ""}>{row.status}</span></td><td>{row.source ?? "Unattributed"}</td><td>{row.finished_at ? `${Math.max(0, (Date.parse(row.finished_at) - Date.parse(row.started_at)) / 1000).toFixed(1)}s` : "—"}</td><td>{row.source_aircraft_count}</td><td className={styles.detail}>{row.error ?? "—"}</td></tr>)}
        </tbody></table></div>
        {!rows.length && <p className={styles.empty}>No recorded runs for this source and period. Try another source or a longer period.</p>}
      </section>
    </>
    <footer className={styles.note}>Run outcomes can include processing or database failures. Failed runs without a recorded source appear under All sources. History follows the existing retention policy.</footer>
  </main>;
}

