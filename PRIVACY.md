# Privacy

AllianceLab is maintained by Abhijay Panwar. It has no scouting backend, account system, advertising, telemetry, or analytics.

Events, scout names, notes, observations, preferences, and drafts are saved locally in the browser profile. Browser storage is not encrypted. Another person with access to that profile can read the data.

The active workspace and previous saved snapshot use IndexedDB. A migrated v1 localStorage copy is retained separately and is not updated by v1.1. Resetting the active workspace does not erase that migration copy; clearing browser site data removes all local copies and the offline cache. Workspace JSON backups include drafts and planner selections; event-only and QR transfers omit local drafts.

JSON and CSV exports contain scouting information and may include names and free text. QR codes contain the same portable data. Share them intentionally. No file or QR content is uploaded by the app.

Camera frames and imported images are decoded on the device using jsQR. Frames are not sent to a service. Camera access starts only when requested and tracks stop when the scanner stops or unmounts.

A hosting provider can receive ordinary web requests and connection metadata while serving the application. Fonts, scripts and styles are bundled with the app. Visiting GitHub through the source link is a separate service.

Clearing browser site data removes the workspace and offline cache. Export backups first. Use Event settings to delete an event or reset the local workspace. Backups already shared or downloaded are separate copies and must be removed separately.
