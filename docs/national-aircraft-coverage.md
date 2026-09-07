# Nationwide law enforcement aircraft coverage

Added 565 aircraft registrations across 42 of the 44 newly supported states.
All 50 states are selectable. Rhode Island and Vermont have explicit coverage-gap
messages, rather than invented aircraft or aircraft assigned from neighboring states.

## Sources and verification

- [FAA Releasable Aircraft Database](https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download), MASTER snapshot **2026-09-04**,
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
| Alabama | 58 | Registry-attributed aircraft |
| Alaska | 45 | Registry-attributed aircraft |
| Arizona | 37 | Registry-attributed aircraft |
| Arkansas | 11 | Registry-attributed aircraft |
| Connecticut | 7 | Registry-attributed aircraft |
| Delaware | 5 | Registry-attributed aircraft |
| Georgia | 28 | Registry-attributed aircraft |
| Hawaii | 2 | Registry-attributed aircraft |
| Idaho | 1 | Registry-attributed aircraft |
| Illinois | 14 | Registry-attributed aircraft |
| Indiana | 12 | Registry-attributed aircraft |
| Iowa | 4 | Registry-attributed aircraft |
| Kansas | 7 | Registry-attributed aircraft |
| Kentucky | 19 | Registry-attributed aircraft |
| Louisiana | 26 | Registry-attributed aircraft |
| Maine | 1 | Registry-attributed aircraft |
| Maryland | 23 | Registry-attributed aircraft |
| Massachusetts | 6 | Registry-attributed aircraft |
| Michigan | 15 | Registry-attributed aircraft |
| Minnesota | 7 | Registry-attributed aircraft |
| Mississippi | 11 | Registry-attributed aircraft |
| Missouri | 15 | Registry-attributed aircraft |
| Montana | 5 | Registry-attributed aircraft |
| Nebraska | 7 | Registry-attributed aircraft |
| Nevada | 10 | Registry-attributed aircraft |
| New Hampshire | 2 | Registry-attributed aircraft |
| New Jersey | 9 | Registry-attributed aircraft |
| New Mexico | 8 | Registry-attributed aircraft |
| New York | 48 | Registry-attributed aircraft |
| North Carolina | 19 | Registry-attributed aircraft |
| North Dakota | 1 | Registry-attributed aircraft |
| Oklahoma | 10 | Registry-attributed aircraft |
| Oregon | 9 | Registry-attributed aircraft |
| Pennsylvania | 11 | Registry-attributed aircraft |
| Rhode Island | 0 | No verified crewed aircraft identified; research gap |
| South Carolina | 20 | Registry-attributed aircraft |
| South Dakota | 1 | Registry-attributed aircraft |
| Tennessee | 23 | Registry-attributed aircraft |
| Utah | 6 | Registry-attributed aircraft |
| Vermont | 0 | No verified crewed aircraft identified; research gap |
| Virginia | 16 | Registry-attributed aircraft |
| West Virginia | 2 | Registry-attributed aircraft |
| Wisconsin | 3 | Registry-attributed aircraft |
| Wyoming | 1 | Registry-attributed aircraft |
