# Deployment and offline installation

AllianceLab is a static client application. It needs no environment variables, API keys, or backend services.

## Build

Use Node 22.23+ or 24, then:

```sh
npm ci
npm run check
npm run build
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
2. Wait for “App cached” in the sidebar.
3. Install through the browser’s install command, or use Add to Home Screen where supported. If installation is unavailable, bookmark the URL.
4. Turn off the connection, reload, and open every screen you need.
5. Import the shared event setup, then record a practice observation.
6. Export a backup and verify that a teammate can import it.

Camera access requires HTTPS or localhost and a supported camera permission flow. When camera access is unavailable, import QR images, paste transfer frames, or use JSON files.

## Updates

A new service worker waits while the current app is open. “Update app” asks before restarting. Saved data and match drafts remain; save pit-form changes first. Shell caches and scouting data are separate.

## Recovery

If storage writes fail, leave the tab open and download a workspace backup. If stored data is unreadable, the app preserves the raw text and offers a recovery download. Reset only after saving that copy. A valid JSON backup can be restored through Transfer center.
