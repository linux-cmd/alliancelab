# v1.1.0 verification

Local checks completed on 2026-10-26 (America/Chicago), using Node 24 and the production build.

- Formatting, TypeScript, Vite build, and offline-shell generation passed.
- 30 unit tests passed, including v1 migration, IndexedDB transactions and rollback, stale writers, previous snapshots, schedule parsing, duplicate/conflicting observations, QR transport, and a 500-team / 50,000-observation analytics fixture.
- 40 browser cases passed across desktop Chromium and an emulated iPhone viewport, with no retries or skipped cases.
- Main screens and expanded scouting, planning, and dialog controls passed the included WCAG A/AA axe checks and viewport checks.
- Scouting checks covered match entry/editing, pit drafts across team changes, immediate navigation, offline reload, reviewed schedules, station queues, version 1 migration, workspace-draft restore, failed browser writes, and paused saves that preserve forms.
- Transfer checks covered repeated and malformed JSON, multipart QR text, generated QR image decoding, CSV export, and reviewed replacement.
- Desktop and phone screenshots were visually inspected; the save action no longer covers fields, optional panels remain closed initially, and secondary text has adequate automated contrast.
- `npm audit --audit-level=high` reported zero known vulnerabilities in the locked tree at verification time.

The GitHub `check` job repeats the formatting, unit, build, dependency, and full browser gates. Every browser case also fails on an uncaught application exception. Stable tags must agree with `package.json` before release assets are published.

## Deployment and upgrade check

The public deployment at https://alliancelab.vercel.app was verified on 2026-10-27 UTC (2026-10-26 America/Chicago), using source commit `115fcb5d82d61f515ead37343c66d04a8bc21db9`.

- The full 40-case desktop/mobile browser suite passed against the public HTTPS origin, with no retries, skipped cases, or uncaught application exceptions.
- A preserved v1 browser profile with its installed worker and 30 fictional observations completed the app update and migrated automatically.
- Saving another observation produced 31 persisted records. An offline reload and navigation to Teams retained all 31, while the original v1 localStorage copy still contained its original 30.
- The upgrade flow reported zero uncaught application errors. HTTP 200 and the configured Content-Security-Policy were checked at the public origin.
- The GitHub check for the same source commit passed: [workflow run 40442252219](https://github.com/linux-cmd/alliancelab/actions/runs/40442252219).

The release gates also verify that keyboard skip navigation preserves the current screen and focuses its content. The final tag pipeline repeats the checks before packaging.

## Device limits

Physical camera permissions, autofocus, lighting, and scanning on real phones were not exercised in this environment. Emulation does not establish physical device behavior. QR image/text/file fallbacks were verified. No real competition or student records were used.
