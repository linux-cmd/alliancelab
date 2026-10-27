# Security

## Reporting a problem

Report a reproducible issue at https://github.com/linux-cmd/alliancelab/issues without attaching private scouting exports, student information, credentials, or sensitive browser paths. If the issue contains sensitive information, describe the category and request a private contact before posting details.

## Boundaries

AllianceLab is a local browser application. It does not authenticate scouts or verify the identity of imported data. QR checksums detect incomplete or damaged transfers; they do not provide signatures. Scouting decisions should consider source trust and conflicting observations.

Portable data is validated for supported schema versions, bounded sizes, types, IDs, metric definitions and references. React renders imported strings as text. The app does not execute imported HTML or evaluate formulas. CSV exports prefix formula-like strings and quote fields.

Browser profile access is outside the app’s protection boundary. Local storage is not encrypted. Shared devices and private browsing require care and regular backups.

The application does not store API credentials or contact FIRST systems. Do not add secrets to this repository. Dependency versions are locked; `npm audit`, unit tests and browser checks are part of the release process.

Version 1.x receives fixes on the main branch. Backup the workspace before upgrading.
