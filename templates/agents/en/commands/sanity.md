---
description: Runs the brain-corp sanity check over workspace tickets.
agent: build
---

Run the structural sanity check and ticket coherence analysis.

```bash
node scripts/sanity-check.js --write --json
```

Then follow the protocol in `.opencode/commands/sanity-check.md`: fix domains, dependencies, duplicates and format before synchronizing.
