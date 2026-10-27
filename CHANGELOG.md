# Changelog

## 1.1.0 — 2026-10-26

- Simplified navigation to Home, Scout, Teams, and Plan, with secondary tools under Manage.
- Cleaner typography, quieter cards, larger controls, and optional notes, logs, priorities, and comparisons.
- Reviewed schedule CSV import, station assignments, and automatic next-match entry.
- Persistent pit and editing drafts; failed saves preserve forms and cannot report success.
- Transactional IndexedDB storage with revision checks, v1 migration, and a previous saved snapshot.
- Portable schema v2 with schedules and optional workspace drafts; v1 backups remain supported.
- One-pass event aggregation and reused team summaries, including a 50,000-observation fixture.
- Consistent offline app versions, recovery-envelope import, and backup reminders.
- Version-tag release automation, formatting checks, pinned Actions, and weekly dependency updates.

## 1.0.0 — 2026-10-26

First stable release.

- Configurable events, team rosters and season-independent match metrics.
- Match scouting with autosaved drafts, touch counters, editing and review.
- Pit notebooks with drivetrain, weight, autonomous notes, strengths and concerns.
- Distinct-match analytics, consistency, reliability and conflicting-observation detection.
- Four-team comparisons and a configurable alliance pick list.
- Two three-team alliance workspaces with transparent estimated totals.
- Reviewed JSON backup merge and restore, safe match CSV export, multipart QR transfer, camera and image scanning.
- Complete offline application cache, install/update controls and bundled fonts.
- Corrupt-storage recovery, visible save failures and protection against concurrent-tab overwrites.
- Separate labeled demonstration data.
- Desktop and phone browser checks, accessibility checks, unit tests and a reproducible release workflow.
