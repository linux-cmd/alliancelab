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

The release procedure preserves a browser profile running v1 with 30 fictional observations and its installed worker, then verifies the new public deployment, app update, automatic migration, and an offline reload. Deployment results are recorded here before the stable tag is published.

## Device limits

Physical camera permissions, autofocus, lighting, and scanning on real phones were not exercised in this environment. Emulation does not establish physical device behavior. QR image/text/file fallbacks were verified. No real competition or student records were used.
