# AllianceLab release plan

Author and maintainer: Abhijay Panwar

## Product

A mobile-friendly FRC scouting workspace that keeps working without venue Wi-Fi. Scouts capture match and pit observations; drive teams compare evidence and prepare alliance choices. No account or hosted database is required.

## v1 acceptance criteria

- Create events with editable season metrics and an explicit roster.
- Capture, draft, edit and delete match observations; preserve original IDs when editing.
- Record pit observations, including drivetrain and capabilities.
- Compare team averages, variation, reliability, sample size and observation conflicts.
- Build a transparent weighted pick list and two-alliance comparison without presenting estimates as official scores or win probabilities.
- Save all working data locally; preserve drafts; explain storage failures; export and restore versioned JSON backups.
- Export useful CSV with spreadsheet formula protection.
- Transfer selected event observations via multipart QR codes, camera and image scanning; validate and preview imports.
- Distinguish demo data from actual scouting and allow clearing it independently.
- Work at phone and desktop widths, support keyboard access and reduced motion, and install for offline use.
- Test calculation, malformed input, merge, QR reconstruction and real browser workflows.
- Ship versioned source, MIT license, architecture notes, contribution guide, privacy statement, changelog and reproducible CI.

## Delivery milestones

1. Data model, validation, analytics, backup and transfer contracts.
2. Workspace, event setup, roster, match and pit scouting.
3. Team analytics, comparisons, alliance planning and review.
4. Transfer center, JSON/CSV backups and PWA.
5. Accessibility, responsive polish and browser verification.
6. Release documentation, CI and v1.0.0 tag.
