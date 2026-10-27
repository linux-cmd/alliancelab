# v1.0.0 verification

Verified on 2026-10-26 (America/Chicago).

- Production TypeScript and Vite build completed successfully.
- 19 Vitest tests passed across data boundaries, import merges, distinct-match calculations, CSV handling and QR framing.
- 24 Playwright tests passed across desktop Chromium and an emulated iPhone viewport, with no retries or skipped tests.
- Every main screen passed the included WCAG A/AA axe checks and viewport checks.
- Browser flows covered creating an event, scouting and editing, draft persistence, offline reloads including lazy screens, reviewed backups, repeated/malformed imports, QR text and generated-image scanning, pit notes, planner persistence, event deletion, corruption recovery and concurrent tabs.
- npm audit reported no known vulnerabilities in the locked dependency tree at the time of the check.
- https://alliancelab.vercel.app returned HTTP 200 with the configured security headers. The deployed app generated transfer QR frames and reloaded its transfer screen offline successfully.

The included GitHub workflow repeats the unit, production-build, dependency and browser checks before packaging the stable release.

Physical camera permission behavior and scanning on an actual phone were not verified in this environment. Emulation is not a substitute for physical device testing. QR image import and text/file fallbacks were verified. No live competition observations were used; the bundled demo remains fictional.
