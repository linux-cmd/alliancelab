AllianceLab v1.1.0 makes everyday scouting simpler and protects work across navigation, failed writes, and upgrades.

- Four primary screens: Home, Scout, Teams, and Plan. Backups, sharing, and settings live under Manage.
- A quieter layout, readable controls, fewer simultaneous panels, and optional notes, logs, priorities, and comparison alliances.
- Match schedules imported from reviewed CSV files, with station assignments and automatic next-match entry.
- Pit drafts per team, persistent match edits, and forms that remain intact when a save is rejected.
- Transactional IndexedDB storage, automatic v1 migration, revision protection across tabs, and a previous saved-data snapshot.
- Version 2 workspace backups include drafts and planner selections. Existing v1 backups remain supported.
- Event analytics aggregate observations once and reuse the summaries across screens.
- Consistent offline app versions, a generic release workflow, formatting gates, and weekly dependency update PRs.

Created and maintained by Abhijay Panwar. Existing v1 localStorage data is retained during migration. Export a backup before upgrading and verify an offline reload on each scouting device.

The web ZIP is a static build for HTTPS or localhost. Physical phone camera behavior still requires testing on your intended devices; camera images and text/file transfer fallbacks are supported.
