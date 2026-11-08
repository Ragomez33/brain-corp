---
name: ticket-ops
description: Create, validate, normalize and synchronize brain-corp tickets.
---

# Ticket operations

- Create: `/cross-analyze <topic>` or `node scripts/hotfix.js`.
- Validate: `node scripts/sanity-check.js --write --json`.
- Publish: `node scripts/sync-github.js`.
- Import: `node scripts/sync-pull.js`.
- Normalize: `node scripts/normalize-ticket.js --auto`.
- Close: `node scripts/complete-ticket.js TICK-XXX [PR]`.

The frontmatter must include `id`, `title`, `author`, `target_domain`, `status`, `created_at` and `dependencies`.
