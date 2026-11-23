# Out Of Sight 1.0.4 (222)

At the owner's request, build **222** replaces build 220 in App Store review.
Apple processed the new upload as Valid and App Store Eligible and confirmed
**Waiting For Review** at `2026-11-23T21:34:36.666Z`.
**Automatic release after approval** remains enabled (`AFTER_APPROVAL`).

Calibration now accepts gentle movement without a GPS speed restriction and
averages a short window of gravity readings. Abrupt movement and stale or
invalid readings still defer calibration. Calibration remains explicit, with
no continuous recentering; stopping upright on level ground gives the best
reference. The calibrated icon and border now use the Clear color of the
selected distance palette. The five palettes, Color Modes, gauge selector,
Lean arc, Moving horizon, and CarPlay help from build 220 remain included.

The signed archive and App Store package match all **214 interface files**
from the phone-installed build 222. App/widget source matches that phone build
apart from declaring build 222 in project metadata rather than using its
build-time override. Both report **1.0.4 (222)**. Distribution signatures,
production notifications, shared App Group access, and disabled debugging were
verified. Membership purchases, native billing, Elite Settings, and rider
sharing remain excluded.

The approved description, listing name/subtitle, privacy URLs, review contact,
and ten ordered screenshots are preserved. Release/reviewer notes describe
the new calibration behavior. Automatic tester notifications are disabled;
no all-tester notification or backend deployment was made. No Android package
was built or uploaded. The owner's direct phone-update preference is recorded
in `AGENTS.md`.

- App Store version: `8bdf8e81-7ab0-48f2-97dc-295b4533bbd5`
- Build: `e8b9a45e-2510-467f-a1b9-979f7921e772`
- Review submission: `ad254d7a-c4e1-4b24-87ff-b29989cd8180`

Public notes are in `references/app-store-1.0.4-222/`. Private archive, signing,
upload, and submission evidence is in `.local/appstore-222/`.
