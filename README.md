<p align="center"><img src="public/icon.svg" width="56" alt="AllianceLab logo"></p>
<h1 align="center">AllianceLab</h1>
<p align="center"><strong>Offline scouting. Clearer alliance decisions.</strong></p>
<p align="center">Created and maintained by <a href="https://github.com/linux-cmd">Abhijay Panwar</a>.</p>
<p align="center"><a href="../../actions/workflows/check-release.yml"><img src="https://github.com/linux-cmd/alliancelab/actions/workflows/check-release.yml/badge.svg" alt="Build and checks"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-466747" alt="MIT license"></a> <a href="../../releases/tag/v1.1.0"><img src="https://img.shields.io/badge/release-v1.1.0-466747" alt="Version 1.1.0"></a></p>

**[Open the app](https://alliancelab.vercel.app)** · [Download v1.1.0](https://github.com/linux-cmd/alliancelab/releases/tag/v1.1.0)

AllianceLab is an independent FRC scouting workspace that keeps working without venue Wi-Fi. Scouts record observations, compare the evidence, and prepare a pick list. No account, API key, or database server is needed.

![AllianceLab 1.1 event overview with fictional observations](docs/overview.jpg)

<details><summary>Phone layout</summary><p><img src="docs/mobile.jpg" width="320" alt="AllianceLab on a phone"></p></details>

## A simpler workspace

- **Home** — event coverage, team averages, and your next scheduled assignment.
- **Scout** — match counters and pit notes, with drafts kept separately for each team and saved-record edit.
- **Teams** — sample sizes, consistency, reliability, notes, and comparisons for up to four teams.
- **Plan** — an alliance builder and working pick list. Open priorities or a second alliance when needed.

**Manage** contains event setup, match schedules, backups, CSV exports, and QR sharing. Optional controls stay collapsed until needed. The demo is clearly labeled and uses entirely fictional observations.

## Start scouting

1. Create an event and paste a roster, one team per line: `6901, Knights Robotics`.
2. Review the practice metrics or customize them for your season. Definitions are fixed after the first saved match.
3. Share one event setup with your crew before they start, so every device uses the same IDs.
4. Record matches and pit visits. Review conflicts before making a pick.
5. Download a workspace backup after each session.

For scheduled scouting, open **Manage → Event settings → Match schedule** and import a CSV:

```csv
match,team,alliance,station
1,6901,red,1
1,254,blue,1
2,254,red,1
2,6901,blue,1
```

All scheduled teams must be on the roster. Red and blue have stations 1–3; partial schedules are accepted. Imports are validated and reviewed before replacing the schedule. Choose your station on **Scout** to fill in the next assignment; saving advances to the next scheduled team.

## Data you control

The workspace is saved transactionally in the browser’s IndexedDB. Match, pit, and editing drafts survive navigation. A previous saved data snapshot is retained when observations or event settings change, and another tab cannot silently overwrite a newer revision.

Existing v1 browser data migrates automatically. Its original localStorage copy is retained separately and is not updated by v1.1. Both v1 and v2 JSON backups are accepted. New workspace backups include local drafts and planner selections; **Replace workspace** restores them. Merge imports preserve local drafts, and event-only exports omit them.

Keep a backup outside the browser: clearing site data removes both the workspace and its recovery snapshot. The app has no telemetry or scouting backend. Camera frames stay on the device. Browser data and exports are not encrypted and can contain scout names and notes.

## How estimates work

Scouting totals use your event’s metric weights. Averages and standard deviations use distinct, undisputed team–match pairs. Conflicting observations are flagged and excluded until reviewed; matching observers do not inflate the sample count.

Pick scores normalize observed metrics and apply your chosen priorities. Combined alliance totals add individual averages. These estimates do not model game rules, interactions, or win probability. Defense rating 0 means “not observed” and currently contributes zero to the average.

See the [data and scoring guide](docs/DATA_MODEL.md).

## Run locally

Use Node.js **22.23+ or 24**:

```sh
git clone https://github.com/linux-cmd/alliancelab.git
cd alliancelab
npm ci
npm run dev
```

For an offline-capable production preview:

```sh
npm run build
npm run preview
```

Serve the built `dist/` directory at the root of an HTTPS origin, or use localhost. Opening files directly from disk and subdirectory hosting are unsupported. Wait for **Available offline**, then disconnect and verify a reload before your event.

## Development checks

```sh
npm run check
npx playwright install --only-shell chromium
npm run test:e2e
```

`check` runs formatting, unit tests, TypeScript, and the production build. Playwright starts a preview server automatically and checks desktop and phone workflows. Set `BASE_URL` to check an existing deployment. Use `npm run format` before committing.

The release workflow checks a version tag against `package.json`, runs the same gates, and publishes a static web ZIP and SHA-256 checksum. Dependency update PRs are scheduled weekly.

## Current boundaries

- Local workspaces and reviewed file/QR transfers; no accounts, cloud synchronization, or live FIRST API.
- Qualification matches; other formats need a separate event.
- Up to 100 events, 500 teams per event, 6,000 schedule assignments per event, 50,000 match observations, and 10,000 pit notes. Backups are limited to 50 MB; browser capacity can be lower.
- QR frames are best for small transfers. Their checksum detects damage and does not authenticate the sender.
- Camera permissions, installation prompts, and scanning on physical phones require device testing. Image decoding, offline workflows, and emulated phone layouts are covered by automated checks.

[Architecture](docs/ARCHITECTURE.md) · [Verification](docs/VERIFICATION.md) · [Deployment](docs/DEPLOYMENT.md) · [Contributing](CONTRIBUTING.md) · [Privacy](PRIVACY.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

MIT © 2026 **Abhijay Panwar**. See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled libraries and fonts. AllianceLab is not affiliated with or endorsed by FIRST. FIRST and FRC are trademarks of FIRST.
