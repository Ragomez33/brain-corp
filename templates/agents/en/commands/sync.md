---
description: Publishes backlog tickets as GitHub Issues.
agent: build
---

Synchronize the local backlog with GitHub Issues.

1. Verify that `gh auth status` has an active session.
2. Run the pre-flight sanity check:
   ```bash
   brain sanity --write --json
   ```
3. Publish the tickets:
   ```bash
   brain sync
   ```

Do not use `--skip-sanity` unless the user explicitly requests it.
