---
description: Closes a ticket, records the PR and moves it to .agents/tickets/done/.
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** closing a ticket delivery.

**Received argument:** `$ARGUMENTS`

## Root Orchestrator Mode (mandatory)

- Always work from the brain-corp root; do not use `cd`.
- Do not modify product code in sidecars.
- Use the `.agents`/`scripts` scripts as the source of truth for ticket state.

## Step 1 — Interpret arguments

`$ARGUMENTS` must contain:

1. A ticket ID in `TICK-XXX` format (required).
2. Optionally, a PR URL or number (e.g. `https://github.com/org/repo/pull/42` or `42`).

If the ID is missing, ask the user and stop. If the ID does not exist or is ambiguous, report and stop without modifying files.

## Step 2 — Run the close flow

Run:

```bash
node scripts/complete-ticket.js <TICK-XXX> [PR] --json
```

The script performs, in order:

1. Locates the ticket in any state folder (`.agents/tickets/backlog|in-analysis|ready|done`).
2. Sets `status` to `"done"` in the frontmatter.
3. Adds or updates the `## Delivery` section with the PR reference (if provided) and completion date.
4. Moves the file to `.agents/tickets/done/`.
5. If the ticket has `github_issue`, runs `gh issue close <number> --reason completed` and, when a PR exists, adds a comment with the reference.

Available options: `--repo <owner/repo>` to force the GitHub repository, `--skip-close` to skip issue closing, `--dry-run` to simulate without writing or closing, `--json` for structured output.

## Step 3 — Handle results

- If the script succeeds, report: ticket, final path, status, registered PR and closed issue (or why it was skipped).
- If GitHub closing fails due to authentication, ask to run `gh auth login` and re-run the script. The local ticket will already be in `done/`.
- If the ticket had no `github_issue`, state that it was only completed locally.
- Do not manually edit frontmatter or move the file if the script failed before completing; report the exact error.

## Step 4 — Final verification

Confirm that:

- The file is in `.agents/tickets/done/`.
- The frontmatter contains `status: "done"`.
- The body contains the `## Delivery` section with `- PR:` (if provided) and `- Completed:`.
- The GitHub issue was closed or the omission was explained.
