---
description: Publishes backlog tickets as GitHub Issues.
agent: build
---

Synchronize the local backlog with GitHub Issues.

1. Verify that `gh auth status` has an active session.
2. Run the pre-flight sanity check:
   ```bash
   node scripts/sanity-check.js --write --json
   ```
3. Publish the tickets:
   ```bash
   node scripts/sync-github.js
   ```

Do not use `--skip-sanity` unless the user explicitly requests it.
