# Architecture

AllianceLab is a static React/TypeScript application built with Vite. No runtime backend, credentials, or account system is needed.

## Modules

- `domain.ts`: versioned portable schemas, v1 migration, referential validation, merges, IDs, and conflicts.
- `storage.ts`: transactional IndexedDB persistence, legacy loading, optimistic revision checks, a previous saved snapshot, and downloads.
- `analytics.ts` and `useEventStats.ts`: one-pass event grouping, memoized team summaries, transparent ranking, and safe CSV export.
- `schedule.ts`: bounded schedule CSV parsing, roster/station validation, and next-assignment selection.
- `transfer.ts`: bounded multipart QR framing, reconstruction, and integrity checks.
- `App.tsx`: loading, state, validated mutations, serialized writes, cross-tab protection, navigation, and app updates.
- `pages/` and `components/`: four main workflows and secondary management tools, with optional controls disclosed on demand.
- `scripts/generate-sw.mjs`: a content-versioned offline shell with an app-version handshake.

## State and persistence

React holds saved data, preferences, and drafts. A data mutation returns success or failure; a rejected mutation leaves the form intact and cannot trigger a success reset. Drafts update in shared state immediately, so navigating away does not cancel a pending component debounce.

The IndexedDB database `alliancelab`, object store `workspace`, contains `current` and `previous`. Each write transaction checks the expected revision before updating. A stale writer is rejected atomically. Writes are serialized in the tab, and storage/BroadcastChannel messages pause another tab. Origin notifications contain only a revision and a per-tab ID.

Changing saved data rotates the preceding workspace into `previous`. Draft or preference writes do not overwrite that recovery snapshot. Both records are browser-local and can be removed by clearing site data; they supplement external JSON backups.

When IndexedDB has no current record, the loader reads `alliancelab.workspace.v1` from localStorage. Valid v1 data migrates without changing observation IDs or measurements. The original string remains untouched. Unreadable data enters recovery mode before writes can replace it. Database failures leave current state available for download and retry.

Draft keys are scoped to an event: `match:<event>`, `edit:<event>:<record>`, `pit:<event>:<team>`, and `planner:<event>`. Pages validate restored drafts before use. Event deletion removes its drafts. A changed metric definition requires explicit draft review before saving.

## Portable data

Version 2 adds schedules and optional workspace-local drafts. The parser migrates v1 backups and rejects unknown future versions. Imports are bounded to 50 MB, validated, and reviewed before applying. Existing event definitions remain authoritative during a merge, while compatible roster entries and schedule assignments can be added. Identity or metric conflicts cancel the merge.

Workspace exports include drafts and planner selections. Replace imports restore them; merge imports preserve the receiving device’s drafts. Event transfers omit local drafts. Recovery envelopes can also be reviewed through the import screen.

## Offline lifecycle

The worker precaches every application chunk, font, stylesheet, icon, and manifest. Navigation uses its own cached HTML, keeping code and cache versions consistent until an explicit update. Content-addressed assets are matched by path with Vary ignored.

New workers wait. Updating waits for queued writes, activates the worker, and reloads. The page checks the active worker’s application version before claiming offline readiness. During the v1 upgrade, an old worker cannot authorize editing a new page until the shell update is completed. Development mode does not register a worker.

## Verification

Unit tests exercise schemas, migrations, schedules, merges, storage rollback, stale writes, analytics, and QR transport. Browser tests exercise the user flows at desktop and phone widths, including failed saves and recovery. Automated accessibility checks cover the main screens and expanded controls. Physical camera testing remains distinct from browser emulation.
