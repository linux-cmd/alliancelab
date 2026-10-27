# Deployment and offline installation

AllianceLab is a static client application. It needs no environment variables, API keys, or backend services.

## Build

Use Node 22.23+ or 24, then:

```sh
npm ci
npm run check
```

Host the contents of `dist/` at the root of an HTTPS origin. Localhost is also a secure context for browser development. The app uses root-relative URLs and is not configured for subdirectory hosting.

The service worker precaches all application chunks, including screens the user has not visited yet. It is not registered in `npm run dev`; use a production build and preview to test offline behavior.

## Vercel

Import this GitHub repository as a Vite project. Use `npm run build` and output directory `dist`. The repository’s `vercel.json` supplies browser headers. A hosted deployment must be accessible to the scouts who will use it; check your project’s deployment protection and audience settings before distributing a URL.

## Other static hosts

Copy `dist/` to a static web server. The app uses hash navigation, so no server-side route rewriting is required. Serve `sw.js` with `Cache-Control: no-cache`, the manifest as `application/manifest+json`, and content-hashed assets with a long immutable cache policy.

The downloadable release web ZIP contains the contents of `dist/`. Extract it into your web root.

## Before an event

1. Open the production URL on each intended device.
2. Wait for “Available offline” in the sidebar and finish any pending app update.
3. Install through the browser’s install command, or use Add to Home Screen where supported. If installation is unavailable, bookmark the URL.
4. Turn off the connection, reload, and open every screen you need.
5. Import the shared event setup, then record a practice observation.
6. Export a backup and verify that a teammate can import it.

Camera access requires HTTPS or localhost and a supported camera permission flow. When camera access is unavailable, import QR images, paste transfer frames, or use JSON files.

## Updates

A new service worker waits while the current app is open. “Update app” waits for queued saves, then restarts with the complete cached version. Match, pit, and editing drafts remain. The active worker serves its own cached HTML to keep code and cache versions consistent. An old v1 worker must finish the shell update before the new page allows scouting. Shell caches and scouting data are separate.

## Recovery

If storage writes fail, leave the tab open and download a workspace backup, including local drafts. If stored data is unreadable, the app preserves the raw text and offers a recovery download. Reset only after saving that copy. Backups and valid recovery envelopes can be reviewed in Manage → Backups & sharing. Manage → Event settings → Storage & recovery also offers the previous saved snapshot.

## Publishing a release

Update `package.json`, the lockfile, changelog, release notes, and documentation. Open a pull request, wait for the required `check` job, and merge. Tag the tested main commit with the matching stable version, for example `v1.1.0`. Pushing that tag runs the checks and publishes the static web ZIP plus `SHA256SUMS.txt`. A mismatched tag/package version fails before publication. Deploy the same tagged commit to the intended Vercel project and verify the public origin.
