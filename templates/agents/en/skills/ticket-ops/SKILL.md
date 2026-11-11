---
name: ticket-ops
description: Create, validate, normalize and synchronize brain-corp tickets.
---

# Ticket operations

- Create: `/cross-analyze <topic>` or `brain hotfix`.
- Validate: `brain sanity --write --json`.
- Publish: `brain sync`.
- Import: `brain sync:pull`.
- Normalize: `brain normalize --auto`.
- Close: `brain complete TICK-XXX [PR]`.

The frontmatter must include `id`, `title`, `author`, `target_domain`, `status`, `created_at` and `dependencies`.
