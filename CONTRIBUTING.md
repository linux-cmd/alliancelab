# Contributing

Maintainer: Abhijay Panwar.

Open an issue with the user problem, expected behavior and a small reproduction before proposing a large change. Use fictional scouting records in examples and tests.

## Setup

Use Node 22.23+ or 24. Run `npm ci`, `npm run dev`, and `npm run check`. Install Chromium with `npx playwright install --with-deps chromium`, then run `npm run test:e2e` against a production preview. In CI the Playwright configuration starts its own preview server.

For a local full browser run, build and start the preview on port 5173 in a separate terminal:

```sh
npm run build
npm run preview -- --port 5173
```

Then run `npm run test:e2e`.

## Changes

Use a focused branch and small commits that explain the behavior being changed. Include relevant tests for data boundaries, calculations, import behavior or user workflows. Keep strings readable, use labeled controls, and check the phone layout.

Preserve stable observation IDs and explicit schema versions. Do not silently reinterpret old metrics or replace event definitions during imports. Changes to the portable data contract require a migration plan.

Before requesting review, run `npm run check`, the relevant browser tests, and `npm audit`. Include the results and remaining limits in the pull request. Avoid adding generated reports, local datasets or credentials.

Contributions are licensed under the repository’s MIT license.
