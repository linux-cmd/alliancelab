# AllianceLab 1.1 implementation plan

## Goal

Make the daily scouting workflow easier to understand and protect observations when forms, devices, and data formats change. Keep the application usable offline and preserve every existing v1 backup.

## Work and acceptance criteria

1. **Reliable saving and drafts.** Return success or failure from data changes; retain a rejected form; autosave pit drafts per team and editing drafts; flush pending drafts when navigating. Validate drafts against current metrics. Verify rejected saves and switching teams never discard work.
2. **Storage and migration.** Add an explicit v1-to-v2 portable-data migration for schedules. Store the workspace transactionally in IndexedDB with a previous saved snapshot; migrate and retain the original localStorage workspace. Detect writes from other tabs and offer recovery downloads and backup reminders. Verify legacy loads, migrations, restores, write failures, and offline persistence.
3. **Schedule workflow.** Import a reviewed qualification schedule CSV containing match, team, and alliance, validate roster membership and station uniqueness, and use it to prefill the next assigned match. Include schedules in event transfers. Verify malformed schedules and the full import-to-scout flow.
4. **Analytics.** Aggregate each event once, memoize by saved data, and reuse summaries in Home, Teams, and Plan. Verify duplicate/conflicting observations and ranking results remain correct; exercise a large fictional event.
5. **Simpler interface.** Use four primary destinations (Home, Scout, Teams, Plan), a single Manage menu, concise headings, larger readable text, and fewer competing panels. Keep optional metrics, notes, comparison alliances, transfer tools, and settings behind clear disclosure controls. Check desktop, phone, keyboard navigation, and automated accessibility.
6. **Release and repository.** Format source, add formatting checks and dependency updates, publish releases through a generic version-aware workflow, update documentation/screenshots, set repository description/homepage/topics, and protect main with successful checks where account permissions permit. Commit each coherent milestone, merge a reviewed release branch, and publish v1.1.0 with downloadable build and checksums.

## Verification and release

Run unit tests, TypeScript/build, dependency audit, formatting checks, and production browser flows on desktop and mobile. Check real production navigation, error output, offline reload, migrated data, QR images, and schedules. Physical phone-camera testing requires hardware and remains documented separately from browser emulation. Record actual results in `docs/VERIFICATION.md` before the stable release.

## Progress

Implementation is complete for safe mutations, drafts, IndexedDB migration/recovery, schedule entry, aggregation, the simplified interface, formatting, dependency updates, and generic release automation. Local gates pass; release verification and the final published commit are recorded in `docs/VERIFICATION.md` and the GitHub release.
