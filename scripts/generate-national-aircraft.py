"""Build the additional 44-state catalog from an FAA ReleasableAircraft.zip.

No network calls or database writes. The input snapshot and audited overrides
are the sources; see docs/national-aircraft-coverage.md for scope and limitations.
Usage: python scripts/generate-national-aircraft.py PATH/TO/ReleasableAircraft.zip
"""
import argparse
import collections
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent.parent
EXISTING_STATES = {"WA", "CA", "TX", "FL", "OH", "CO"}
FAA_URL = "https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download"
AGENCY = re.compile(r"\b(POLICE|P\s?D$|SHERIFF\w*|SHERRIF\w*|PUBLIC SAF[ET]+Y|PUB SAFETY|HIGHWAY PATROL|STATE PATROL|LAW ENFOR[CE]*MENT|STATE TROOPERS?|DNR ENFORCEMENT|ENFORCEMENT DIV|BUREAU OF NARCOTICS)\b")
OUT_OF_SCOPE = re.compile(r"POLICE JURY|POLICE SCIENCE|POLICE FACILITY|SHERIFF CHRISTOPHER|PILOTS ASSOC|\bCBP\b|CUSTOMS|BORDER PROTECTION|AIR AND MARINE")


def records(archive, name):
    with io.TextIOWrapper(archive.open(name), encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            yield {key.strip(): value.strip() for key, value in row.items() if key}


def title(value):
    return value.title().replace("'S", "'s").replace(" Dept", " Department")


def model_info(mfr, model):
    """Retain the registered variant; optionally share an existing type estimate."""
    compact = re.sub(r"[ -]", "", model)
    profile = None
    if "CESSNA" in mfr or ("TEXTRON AVIATION" in mfr and not model.startswith("B")):
        label = f"Cessna {model}"
        if compact.startswith("172"):
            profile = "Cessna 172 Skyhawk"
        elif compact.startswith("182"):
            profile = "Cessna 182 Skylane"
        elif compact == "T206H":
            profile = "Cessna T206H"
        elif compact == "206H":
            profile = "Cessna 206H"
        elif compact == "208":
            profile = "Cessna 208 Caravan"
        elif compact == "208B":
            profile = "Cessna 208B"
        elif compact in {"R172K", "310R"}:
            profile = label
    elif "BELL" in mfr:
        label = f"Bell {model}"
        if compact in {"206B", "407", "412EP", "429", "505", "HH1H", "UH1H", "TH57"}:
            profile = label
        elif compact.startswith("OH58"):
            profile = "Bell OH-58A"
        elif compact.startswith("206L"):
            profile = "Bell 206L"
    elif any(word in mfr for word in ["AIRBUS", "EUROCOPTER"]):
        label = f"Airbus {model}"
        if compact == "AS350B3":
            profile = "Airbus AS350B3 / H125"
        elif compact in {"AS350B1", "AS350B2", "EC120B"}:
            profile = "Eurocopter " + compact
        elif compact == "MBBBK117D2":
            profile = "Airbus H145 / BK117 D-2"
    elif "BEECH" in mfr or (mfr == "TEXTRON AVIATION INC" and model.startswith("B")):
        label = f"Beechcraft {model}"
        if model in {"B200", "B300", "C90A"}:
            profile = f"Beechcraft King Air {model}"
    elif any(word in mfr for word in ["HUGHES", "MCDONNELL", "MD HELICOPTERS"]):
        label = f"MD Helicopters {model}" if model in {"369E", "369FF", "500N", "600N"} else f"Hughes {model}"
        profile = {"369E": "McDonnell Douglas 369E", "369FF": "MD Helicopters 369FF / MD 530F", "500N": "MD Helicopters 500N"}.get(model)
    elif "AGUSTA" in mfr:
        label = f"Leonardo {model}"
    elif "SIKORSKY" in mfr:
        label = f"Sikorsky {model}"
    elif "PILATUS" in mfr:
        label = f"Pilatus {model}"
        if model.startswith("PC-12"):
            profile = "Pilatus PC-12"
    elif "PIPER" in mfr:
        label = f"Piper {model}"
        if model.startswith("PA-31"):
            profile = "Piper PA-31"
    elif "CIRRUS" in mfr:
        label = f"Cirrus {model}"
        if model == "SR22":
            profile = label
    elif "ROBINSON" in mfr:
        label = f"Robinson {model}"
        if model in {"R44 II", "R66"}:
            profile = label
    elif "ENSTROM" in mfr:
        label = f"Enstrom {model}"
    elif "KODIAK" in mfr:
        label = model.title()
    elif "AVIAT" in mfr:
        label = f"Aviat Husky {model}"
    elif "LEARJET" in mfr:
        label = f"Learjet {model}"
    elif "PARTENAVIA" in mfr:
        label = f"Partenavia {model}"
    elif "AERO COMMANDER" in mfr:
        label = f"Aero Commander {model}"
    else:
        label = f"{title(mfr)} {model}"
    return label, profile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    overrides = json.loads((ROOT / "data/national-aircraft-overrides.json").read_text())
    includes = {tail: group for group in overrides["include"] for tail in group["tails"]}
    exclusions = {(row["tail"], row["serial"]): row for row in overrides["exclude"]}
    states_text = (ROOT / "lib/app-states.ts").read_text()
    states = {code: (slug, label) for slug, code, label in re.findall(r'id: "([^"]+)", code: "([^"]+)", label: "([^"]+)"', states_text)}
    existing = set()
    for path in ["lib/seed.ts", "lib/aircraft-directory.ts", "lib/faa-public-safety-aircraft.ts"]:
        existing.update(re.findall(r'"(N[0-9][A-Z0-9]*)"', (ROOT / path).read_text()))
    result, evidence, skipped, found_includes = [], [], [], set()
    with zipfile.ZipFile(args.archive) as archive:
        registry_date = "%04d-%02d-%02d" % archive.getinfo("MASTER.txt").date_time[:3]
        models = {row["CODE"]: row for row in records(archive, "ACFTREF.txt")}
        for row in records(archive, "MASTER.txt"):
            state, tail = row["STATE"], "N" + row["N-NUMBER"]
            if state not in states or state in EXISTING_STATES:
                continue
            ac = models.get(row["MFR MDL CODE"], {})
            # FAA type 6 also contains drones. Seats and a combustion engine
            # distinguish the crewed aircraft covered by this application.
            if (row["STATUS CODE"] != "V" or row["TYPE AIRCRAFT"] not in {"4", "5", "6"}
                    or int(ac.get("NO-SEATS", "0") or 0) < 1
                    or row["TYPE ENGINE"] not in {"1", "2", "3", "4", "5"}):
                continue
            names = [row["NAME"]] + [row[f"OTHER NAMES({i})"] for i in range(1, 6)]
            matching = [name for name in names if AGENCY.search(name)]
            override = includes.get(tail)
            if not matching and not override:
                continue
            if OUT_OF_SCOPE.search(" ".join(names)):
                continue
            excluded = exclusions.get((tail, row["SERIAL NUMBER"]))
            if excluded:
                skipped.append(excluded)
                continue
            if tail in existing:
                skipped.append({"tail": tail, "reason": "Already in an original-state catalog; state reassignment requires separate review."})
                continue
            if override:
                if state != override["state"]:
                    raise ValueError(f"{tail}: registered state changed; review its agency assignment")
                operator = override["operator"]
                found_includes.add(tail)
            else:
                operator = title(row["NAME"] if AGENCY.search(row["NAME"]) else " / ".join([row["NAME"], *matching]))
            model, profile = model_info(ac["MFR"], ac["MODEL"])
            kind = "Helicopter" if row["TYPE AIRCRAFT"] == "6" else "Plane"
            result.append([states[state][0], tail, row["MODE S CODE HEX"], model, operator, title(row["CITY"]), kind, profile])
            evidence.append({
                "tail": tail, "state": state, "serial": row["SERIAL NUMBER"],
                "registeredOwner": row["NAME"], "otherNames": [name for name in names[1:] if name],
                "manufacturer": ac["MFR"], "registeredModel": ac["MODEL"],
                "icao24": row["MODE S CODE HEX"], "registrationStatus": row["STATUS CODE"],
                "registrantType": row["TYPE REGISTRANT"],
                "registrationExpires": row["EXPIRATION DATE"], "seats": int(ac["NO-SEATS"]),
                "operator": operator, "source": override["source"] if override else FAA_URL,
                **({"tailSources": override["tailSources"]} if override and "tailSources" in override else {}),
            })
    missing = set(includes) - found_includes
    if missing:
        raise ValueError(f"Override registrations missing or ineligible: {sorted(missing)}")
    result.sort(key=lambda row: (row[0], row[4], row[1]))
    if len({row[1] for row in result}) != len(result) or len({row[2] for row in result}) != len(result):
        raise ValueError("Duplicate tail or ICAO address")
    header = '''// Generated by scripts/generate-national-aircraft.py. Do not edit rows by hand.
// Registry ownership identifies the agency; it does not confirm current missions,
// airworthiness, operational readiness, or ADS-B reception. See docs/national-aircraft-coverage.md.
import type { AppStateId } from "./app-states";

export type NationalAircraftRow = [
  stateId: AppStateId, tail: string, hex: string, model: string,
  operator: string, registrationCity: string, aircraftType: "Helicopter" | "Plane",
  performanceModel: string | null,
];

'''
    text = header + f'export const NATIONAL_AIRCRAFT_REGISTRY_DATE = "{registry_date}";\n\n'
    text += 'export const NATIONAL_AIRCRAFT_ROWS: NationalAircraftRow[] = [\n'
    text += "".join("  " + json.dumps(row, ensure_ascii=False) + ",\n" for row in result) + "];\n"
    (ROOT / "lib/national-aircraft-data.ts").write_text(text, encoding="utf-8")
    provenance = {"registryDate": registry_date, "registrySource": FAA_URL,
                  "archiveSha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
                  "aircraft": sorted(evidence, key=lambda row: (row["state"], row["tail"])),
                  "excluded": skipped, "coverageGaps": overrides["coverageGaps"]}
    (ROOT / "data/national-aircraft-sources.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    counts = collections.Counter(row["state"] for row in evidence)
    gaps = set(states) - EXISTING_STATES - set(counts) - set(overrides["coverageGaps"])
    if gaps:
        raise ValueError(f"New state coverage gaps need review: {sorted(gaps)}")
    coverage = f'''# Nationwide law enforcement aircraft coverage

Added {len(result)} aircraft registrations across {len(counts)} of the 44 newly supported states.
All 50 states are selectable. Rhode Island and Vermont have explicit coverage-gap
messages, rather than invented aircraft or aircraft assigned from neighboring states.

## Sources and verification

- [FAA Releasable Aircraft Database]({FAA_URL}), MASTER snapshot **{registry_date}**,
  downloaded September 7, 2026. The archive SHA-256 and selected source fields are in
  [national-aircraft-sources.json](../data/national-aircraft-sources.json).
- The FAA owner and additional-name fields identify a law enforcement agency.
  Government ownership alone is not sufficient: unrelated transport, firefighting,
  mosquito-control, military, education, and private-owner aircraft are excluded.
- Ambiguous state/city ownership is resolved through the agency/manufacturer and
  supplementary tail references in [national-aircraft-overrides.json](../data/national-aircraft-overrides.json).
- Only valid registrations for crewed fixed-wing aircraft and helicopters are selected.
  Drone records are excluded using aircraft type, seats and engine type. Existing
  Customs/CBP exclusions and the original six-state catalog are preserved.
- Registry status does **not** establish airworthiness, current mission, operational
  readiness or ADS-B visibility. New mission classifications remain tentative.
  Registration city is labeled as such; it is not represented as an operating base.
- Known destroyed airframes are excluded by **tail and serial number**, so a tail
  reissued to a different aircraft is not automatically excluded. N911SZ serial
  70-16431 is excluded using NTSB CEN22FA317. This is not a nationwide accident-history audit.
- This is a documented registry-based expansion, not a claim that every law
  enforcement aircraft is publicly identifiable. Leased/trust-owned aircraft,
  unregistered public aircraft, future deliveries, and undocumented assignments
  may need further research. No aircraft was inferred solely from an N-number suffix.

## Performance and tracking

Where available, new aircraft share the existing catalog's **type-family estimates**
for fuel, speed and endurance. These are labeled as estimates and are not measured
fuel or an airframe-specific configuration. Unsupported values remain unknown and
do not create fuel countdowns. The exact registered model variant is retained.

National catalog reads are paginated beyond 1,000 rows. Current-state/session ID
lookups and writes use bounded batches. Both ADS-B providers use bounded ICAO
requests. The worker budgets a longer sampling interval for the national fleet
(currently 30 seconds) while retaining the existing takeoff/landing confirmation rules.
Actual freshness remains dependent on provider reception and worker duration.

## Database migration

The new migration inserts the 44 state records before their aircraft and type
profiles. It leaves existing aircraft metadata, inactive rows and profiles intact.
State boundary polygons are not manufactured: as with the original states, they
can be imported separately for coordinate-derived state labels. Alerts use the
catalog home state. Source catalog fallback works before migration; the ingestion
seed sync also creates missing state records before inserting missing aircraft.

## Reproduction

```powershell
python scripts/generate-national-aircraft.py PATH/TO/ReleasableAircraft.zip
npx supabase migration new expand_nationwide_law_enforcement
node --import tsx scripts/generate-national-aircraft-migration.ts PATH/TO/NEW_MIGRATION.sql
npm test
npm run typecheck
```

The import is deterministic for a fixed archive and overrides file. Review newer
registry snapshots and ownership changes before replacing these checked-in sources.

## New-state inventory

| State | Aircraft added | Coverage |
| --- | ---: | --- |
'''
    for code, (_, label) in sorted(states.items(), key=lambda item: item[1][1]):
        if code not in EXISTING_STATES:
            coverage += f"| {label} | {counts.get(code, 0)} | {'Registry-attributed aircraft' if code in counts else 'No verified crewed aircraft identified; research gap'} |\n"
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs/national-aircraft-coverage.md").write_text(coverage, encoding="utf-8")
    print(f"Generated {len(result)} aircraft across {len(counts)} additional states from {registry_date}.")
    print(json.dumps(dict(sorted(counts.items()))))
    print(f"Excluded: {skipped}")


if __name__ == "__main__":
    main()
