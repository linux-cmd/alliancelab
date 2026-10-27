# Architecture

AllianceLab is a static React/TypeScript application built with Vite. No service, credential, account, or database is needed at runtime.

## Modules

- `src/domain.ts`: Zod schemas, versioned backup envelope, data limits, referential validation, merge rules, IDs and conflict detection.
- `src/analytics.ts`: distinct-match aggregation, standard deviation, reliability, normalized pick scores, and safe CSV serialization.
- `src/storage.ts`: browser storage loading and saving, unreadable-storage recovery, and downloads.
- `src/transfer.ts`: bounded multipart QR framing and reconstruction with a transport checksum.
- `src/App.tsx`: workspace state, persistence, corruption recovery, concurrent-tab protection, navigation, install/update lifecycle.
- `src/pages/`: event overview, scouting, team insights, planner, transfers and settings.
- `src/components/`: accessible native dialogs, event configuration and camera/image scanning.
- `scripts/generate-sw.mjs`: a content-versioned offline shell built from the final production assets.

## State and persistence

One React workspace contains saved data, preferences, and local drafts. It is serialized under `alliancelab.workspace.v1` in localStorage. Data changes are schema-validated before entering state. Failed writes leave the in-memory workspace available for export. Failed loads preserve the original stored text until an explicit recovery reset.

Match forms debounce their draft updates by 350 ms. Pit form changes are committed only by Save. Planner priorities and selections are stored as local drafts. Backups contain saved scouting data; local UI preferences and drafts are intentionally outside the portable format.

A storage event from another tab pauses local writes and offers an export and reload. It is a conservative protection against last-writer-wins data loss, not live multi-user synchronization.

## Import boundary

File size is checked before reading. Zod validates shape, counts, bounded strings, real calendar dates, timestamps, unique IDs, event/team references, and metric values. QR input is bounded before reconstruction and passes through the same import parser. Imports are previewed and never applied during scanning.

Merging preserves existing event definitions and adds missing roster entries. A conflicting metric signature or identity collision cancels the merge. Observation IDs identify revisions, and newer timestamps determine updates. Equal-timestamp divergent records cancel the merge. Restoring a full workspace is an explicit replacement action.

## Offline lifecycle

The production build emits a service worker that precaches every application route chunk, font, style, icon and manifest. Navigation falls back to cached HTML; known static assets are matched by path with Vary ignored, because the asset bytes are content-addressed and independent of request headers.

New workers wait until the user approves an update. Old app caches are removed on activation. Scouting storage is separate from shell caches. Development mode does not register a service worker.

## Accessibility and validation

Forms use labels and explicit accessible names where embedded controls could affect label text. Native dialogs provide focus trapping and Escape handling. Navigation, numeric counters, sliders and buttons are keyboard operable. Reduced-motion preferences are respected.

Vitest checks data and calculation boundaries. Playwright checks user flows at desktop and phone widths and runs axe on every main screen. Automated checks do not replace testing with actual event scouts or physical phone cameras.
