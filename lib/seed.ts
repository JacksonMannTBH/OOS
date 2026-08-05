import type { FleetEntry } from "./types";
import { nNumberToIcao } from "./icao";
import { ADDITIONAL_FLEET } from "./aircraft-directory";

// FAA-verified registry. Hexes are baked in where confirmed; entries with
// `hex: null` (or omitted) are resolved at module load via the FAA N-number
// algorithm. lib/icao.test.ts asserts that every seeded hex matches what
// the algorithm produces — typos surface as test failures.
//
// `role` drives the home + radar status pill via lib/status.ts. All three
// alert-tier roles surface as BIRD UP under the rider-facing umbrella;
// the granular role taxonomy still drives body copy and badge tooltips.
//   fixed_wing    → BIRD UP                  (alert / amber)
//   patrol    → BIRD UP                  (alert / amber)
//   unknown   → BIRD UP                  (alert / amber, conservative)
//   sar       → ALL CLEAR + footnote       (clear / green)
//   transport → ALL CLEAR + footnote       (clear / green)
// `roleConfidence` ('confirmed' | 'tentative' | 'unknown') is surfaced in
// the admin editor and as a small badge suffix on /plane/[tail] when not
// confirmed. `roleNote` is operator-facing free text.
//
// The free-text `roleDescription` field (formerly `role`) is the human-
// readable mission summary shown on /about and /plane/[tail].
export const FLEET: FleetEntry[] = [
  // Washington State Patrol — Olympia (all WSP fixed-wing are fixed_wing)
  { tail: "N305DK", hex: "A3323A", operator: "WSP",          model: "Cessna 206H Stationair (FLIR)", nickname: "Bird 4",          roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "fixed_wing",    roleConfidence: "confirmed", roleNote: "Bird 4 — WSP fixed-wing FLIR" },
  { tail: "N305RC", hex: "A3335F", operator: "WSP",          model: "Cessna 182T Skylane",            nickname: null,                roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "fixed_wing",    roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  { tail: "N2446X", hex: null,     operator: "WSP",          model: "Cessna 206H Stationair (FLIR)", nickname: "Bird 3",          roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "fixed_wing",    roleConfidence: "confirmed", roleNote: "Bird 3 — WSP fixed-wing FLIR" },
  { tail: "N102LP", hex: "A00D2A", operator: "WSP",          model: "Cessna 182T Skylane",            nickname: null,                roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "fixed_wing",    roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },
  { tail: "N3532K", hex: null,     operator: "WSP",          model: "Cessna 182T Skylane",            nickname: null,                roleDescription: "Speed enforcement",            base: "KOLM Olympia",                          role: "fixed_wing",    roleConfidence: "confirmed", roleNote: "WSP fixed-wing speed enforcement" },

  // State of Washington (multi-mission, shared with WSP/WSDOT)
  // Owner of record per FAA registry is State of Washington / Olympia, but
  // WSP operates this airframe — it's the all-weather IFR plane the WSP
  // aviation team flies on missions a Cessna 182/206 can't handle.
  { tail: "N207HB", hex: "A1ACB5", operator: "State of WA",  model: "Beechcraft B200 Super King Air", nickname: null,                roleDescription: "Transport / multi-mission (all-weather)", base: "KOLM Olympia (WSP-operated)",          role: "transport", roleConfidence: "tentative", roleNote: "WSP-flown all-weather King Air; owned by State of WA" },

  // King County Sheriff — Renton
  { tail: "N422CT", hex: "A50351", operator: "KCSO",         model: "Bell 407GXi",                    nickname: "Guardian One",       roleDescription: "Patrol / pursuit / SAR",       base: "KRNT Renton",                           role: "patrol",    roleConfidence: "confirmed", roleNote: "Guardian One — multi-role" },
  { tail: "N407KS", hex: "A4C794", operator: "KCSO",         model: "Bell 407",                        nickname: "Guardian One (legacy)", roleDescription: "Patrol / pursuit (backup)", base: "KRNT Renton",                       role: "patrol",    roleConfidence: "tentative", roleNote: "Guardian One legacy airframe" },
  { tail: "N411KS", hex: null,     operator: "KCSO",         model: "Bell 206B JetRanger",             nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "Former KCSO Bell 206B / JetRanger" },
  { tail: "N790RJ", hex: "AAB985", operator: "KCSO",         model: "Bell UH-1H Iroquois",            nickname: "Guardian Two",       roleDescription: "SAR / SWAT insertion",         base: "KRNT Renton",                           role: "sar",       roleConfidence: "tentative", roleNote: "Guardian Two — likely SAR/SWAT" },
  { tail: "N71KP",  hex: "A97AA3", operator: "KCSO",         model: "Bell UH-1H Iroquois",            nickname: null,                roleDescription: "SAR / SWAT (reserve)",         base: "KRNT Renton",                           role: "sar",       roleConfidence: "tentative", roleNote: "KCSO reserve Huey" },
  { tail: "N67817", hex: null,     operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N67880", hex: "A8FCF9", operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },
  { tail: "N78906", hex: "AAB46C", operator: "KCSO",         model: "Bell 206B / TH-67A Creek",       nickname: null,                roleDescription: "Patrol / training",            base: "KRNT Renton",                           role: "patrol",    roleConfidence: "tentative", roleNote: "KCSO Bell 206/TH-67" },

  // Pierce County Sheriff — Puyallup
  // Pierce One is a 2012 Cessna T206H, FAA-registered to Pierce County
  // Sheriff's Department, equipped with FLIR + downlink. Acquired via DHS
  // grant in cooperation with the Port of Tacoma. Pierce Two (older
  // Cessna 206 from 1980s drug seizure) operates as backup but no
  // confirmed tail number publicly — omitted here.
  { tail: "N9446P", hex: null,     operator: "Pierce SO",    model: "Cessna T206H Stationair (FLIR)", nickname: "Pierce One",        roleDescription: "Patrol / SAR / port security", base: "KPLU Thun Field, Puyallup",             role: "fixed_wing",    roleConfidence: "confirmed", roleNote: "Pierce One — Cessna T206H FLIR (2012)" },

  // Snohomish County Sheriff
  { tail: "N815SC", hex: "AB1D82", operator: "Snohomish SO", model: "Bell UH-1H Iroquois Plus",       nickname: "SnoHawk 10",        roleDescription: "Mountain SAR / hoist / SWAT",  base: "Taylor's Landing",                      role: "sar",       roleConfidence: "tentative", roleNote: "SnoHawk 10 — likely SAR" },

  // Spokane County Sheriff — Felts Field
  // SRASU historical fleet: two Bell OH-58s (Air 1 / Air 2, ex-Army
  // surplus 2005) + one Bell UH-1H Super Huey (Rescue 3). N509DV is the
  // Bell 505 added in 2024 (BJA grant 15PBJA-23-GG-00183-BRND); likely
  // assumed the Air 1 designation. OH-58 / UH-1H tails not publicly
  // confirmed — omitted to avoid mis-labeling.
  { tail: "N509DV", hex: "A65BBE", operator: "Spokane SO",   model: "Bell 505 Jet Ranger X",          nickname: "Air 1",             roleDescription: "Patrol / SAR / fugitive apprehension", base: "KSFF Felts Field, Spokane",     role: "patrol",    roleConfidence: "tentative", roleNote: "Spokane SO Bell 505 — likely Air 1 since 2024" },

  // CBP Air and Marine Operations — Bellingham Air and Marine Branch
  // (BAMB), KBLI. Tails + TROY callsigns from RadioReference Wiki. AS350
  // helicopters do interagency support with WCSO + state agencies; the
  // B300C MEA is a fixed-wing Multi-Enforcement Aircraft for surveillance.
  // All four classified as patrol — federal LE under the Bird umbrella.
  { tail: "N1977G", hex: null,     operator: "CBP",          model: "Airbus AS350 / H125",            nickname: "TROY 188",          roleDescription: "Federal patrol / interdiction (helicopter)", base: "KBLI Bellingham AMB",            role: "patrol",    roleConfidence: "confirmed", roleNote: "CBP AMO Bellingham AS350 (TROY 188)" },
  { tail: "N2108J", hex: null,     operator: "CBP",          model: "Airbus AS350 / H125",            nickname: "TROY 169",          roleDescription: "Federal patrol / interdiction (helicopter)", base: "KBLI Bellingham AMB",            role: "patrol",    roleConfidence: "confirmed", roleNote: "CBP AMO Bellingham AS350 (TROY 169)" },

  // US Coast Guard — Air Station Port Angeles, KCLM
  // Non-FAA registered (military serial); hex is authoritative. Air Station
  // Port Angeles operates three MH-65E Dolphins per the 2021 transition
  // delivery; CGNR 6594 is the only one with a publicly documented
  // mode-S hex. Other airframes intentionally omitted until confirmed.
  // Role = sar (clear-tier) — USCG missions are search & rescue, not
  // enforcement against motorists.
  { tail: "CGNR6594", hex: "AE26B4", operator: "USCG",       model: "Eurocopter MH-65E Dolphin",      nickname: "Dolphin 6594",      roleDescription: "Maritime search and rescue",   base: "KCLM Port Angeles",                     role: "sar",       roleConfidence: "confirmed", roleNote: "CGAS Port Angeles MH-65E (Jan 2021 delivery)" },
  ...ADDITIONAL_FLEET,
];

/**
 * Bump when seed shape changes — read by the admin migration route to
 * decide whether to re-merge seed values into the KV-stored registry.
 *
 * v3 (2026-05-07): Statewide expansion — adds 4 CBP/AMO Bellingham
 * entries (N1977G, N2108J, N741C, N128J) and 1 USCG Air Station Port
 * Angeles entry (CGNR6594, MH-65E). Pierce One confidence promoted to
 * confirmed. WSP King Air operator note clarified.
 *
 * v4 (2026-06-12): Adds N411KS so the fixed public tracking list is
 * complete on seed-only deployments.
 *
 * v7 (2026-08-04): Retires N741C from active tracking.
 *
 * v8 (2026-08-04): Retires N128J from active tracking.
 *
 * v9 (2026-08-04): Expands WA, CA, TX, FL, OH, and CO law-enforcement
 * aircraft coverage from the FAA public aircraft registry cross-check.
 *
 * Round-2 research (2026-05-07, no version bump): see the notes block
 * below documenting which agencies were investigated and why they
 * couldn't be added in this pass. The FLEET array did not change.
 */
export const SEED_VERSION = 9;

// Round-2 registry research notes (2026-05-07).
//
// Captures candidates that surface in public reporting but are blocked
// from inclusion because the FleetEntry schema requires either an
// FAA-derivable tail (matches the ^N\d pattern) or a directly supplied
// mode-S hex. Without one of those, the entry can't match live ADS-B
// and would either collide on the empty-hex key or silently fabricate
// a hex that risks a false-positive on an unrelated airframe.
//
// Researched and confirmed to operate aircraft, not yet addable:
//
//   Chelan County Sheriff Air Support Unit (Wenatchee)
//     Two Bell OH-58 helicopters, primarily SAR + counter-drug + patrol.
//     Source: co.chelan.wa.us/sheriff/pages/air-support-unit. No public
//     N-numbers — needs FOIA / direct ops contact.
//
//   Pierce County Sheriff "Pierce Two" backup
//     Older Cessna 206 from 1980s drug-seizure asset, FLIR-equipped.
//     Source: piercecountywa.gov/2156/Air-Operations. No public tail.
//
//   USCG Air Station Port Angeles — MH-65Es beyond CGNR6594
//     Three MH-65Es total per Jan 2021 delivery; helis.com lists 6517
//     and 6603 as candidates but mode-S hexes not publicly documented.
//     Best confirmed via direct USCG pubaffairs request.
//
//   Spokane County Sheriff — legacy OH-58s + UH-1H "Rescue 3"
//     Two Bell OH-58s (Air 1 / Air 2 pre-2024) + UH-1H Super Huey.
//     Source: spokanecounty.gov/1392/Air-Support-Unit. No public tails.
//     The Bell 505 (N509DV) added in 2024 is already in the registry.
//
// Researched and confirmed NOT to operate own aircraft (rely on
// partners or regional consortium):
//
//   - Whatcom County Sheriff (uses CBP/AMO Bellingham)
//   - Clark County Sheriff (uses Portland Air Support)
//   - Kitsap County Sheriff (regional consortium member)
//   - Yakima County Sheriff (no aviation unit found)
//   - Skagit / Cowlitz / Lewis / Mason / Grays Harbor / Clallam SOs
//   - Benton / Franklin / Walla Walla / Asotin / Stevens / Okanogan SOs
//   - Seattle / Tacoma / Bellevue / Vancouver / Spokane PDs
//   - Klickitat County Sheriff Air Wing — volunteer civilian aircraft,
//     pilots fly their own; no agency-owned airframes to register.
//   - WA Department of Fish & Wildlife — no documented aviation
//     enforcement program. WA DNR is firefighting only (out of scope).
//
// Researched but excluded by scope or data quality:
//
//   - Thurston County Sheriff (recently acquired surplus OH-58 but
//     ~6-12 months from operational status; revisit when in service)
//   - FBI Seattle field office — Cessna fleet registered to FBI front
//     companies (KQM Aviation, PXW Services). No Seattle-specific
//     attribution available; tails rotate by op.
//   - DEA / ATF — same pattern, no publicly attributable WA-based tails.
//   - USCG Air Station Astoria (OR) MH-60Ts — operate over the WA
//     southern coast but stationed in OR; out of WA-airspace scope.

export const FEATURED_TAIL = "N305DK";

/** Resolve a fleet entry's effective ICAO24 hex (lowercase). */
export function fleetHex(entry: FleetEntry): string {
  const seeded = entry.hex?.toLowerCase();
  if (seeded) return seeded;
  return (nNumberToIcao(entry.tail) ?? "").toLowerCase();
}
