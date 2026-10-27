# Data and scoring

## Portable format

Backups use the following envelope:

```json
{
  "format": "alliancelab",
  "schemaVersion": 1,
  "kind": "workspace",
  "exportedAt": "2026-10-26T12:00:00.000Z",
  "data": { "events": [], "matches": [], "pits": [] }
}
```

`kind` is either `workspace` or `event`. Only a workspace backup can replace the full workspace; both can be merged.

Event IDs, metric IDs and observation IDs must remain stable. Two separately created events named “Regional” are still different events.

## Event metrics

Each metric has an ID, name, phase, type and value weight. Counts accept whole numbers from 0 to 10,000; yes/no accepts 0 or 1; ratings accept integers from 0 to 5. Every match contains one value for every event metric.

A weighted scouting total is:

```text
total = sum(metric_value × event_metric_weight)
```

The event weights can range from 0 to 100. They are fixed with the metric definitions after the first saved match. They are separate from the planner’s priorities.

## Distinct matches and conflicts

Group observations by event ID, team number, and qualification match number. If all observers agree on metric values, disable status and defense rating, count the match once. Notes and scout names can differ without creating a conflict.

When any of those measured values differ, flag the pair and exclude it from all estimates until the source records agree or the incorrect observation is deleted. Matching observer duplicates are not additional evidence of more matches.

Team average and population standard deviation use the resulting match totals. Reliability is the percentage of undisputed matches without a recorded disable. A partial match with a disable still contributes its observed metrics to the average. Defense averages ratings from 0 to 5, including zeros; 0 is the form’s “not observed” value.

## Relative pick ranking

For each metric, divide the team average by the event’s best observed team average, using 1 as the minimum divisor. Multiply by its priority (0–10). Reliability contributes its percentage divided by 100, and defense contributes its average divided by 5, each multiplied by the corresponding priority.

```text
pick_score = 100 × sum(normalized_value × priority) / sum(priorities)
```

Zero priorities produce a score of 0. Unscouted or fully disputed teams show no usable estimate. Tie-breaking uses usable match count, then team number. Selected teams are removed from the working pick list. Marking a team unavailable changes the local list, not the underlying observations.

Two-alliance comparisons add individual average scouting totals. The comparison omits robot interactions and official scoring constraints and never reports a win probability.

## Transport details

QR frames use `AL1:<checksum>:<part>:<total>:<base64-payload>`. Each payload slice is at most 850 characters, with at most 200 frames. Frames can arrive in any order. Duplicate frames are accepted; mixed transfers, conflicting frame contents, invalid numbering and checksum mismatches are rejected.

The payload is UTF-8 JSON encoded as base64. The checksum is an FNV-1a transport checksum; it is not a cryptographic signature or authentication mechanism. Scan only data from sources you trust. The assembled data still passes full schema validation and import review.

## CSV

Match CSV includes event name, team and match numbers, scout, alliance, raw metrics, disable status, defense, notes, ID, and revision time. All fields are quoted; quotes are escaped. Text beginning with spreadsheet formula indicators is prefixed with an apostrophe. JSON is the authoritative restore format; CSV is an analysis export and cannot be imported.
