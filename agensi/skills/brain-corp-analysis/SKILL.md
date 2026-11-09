---
name: brain-corp-analysis
description: Analyze a multi-repository brain-corp ecosystem and create actionable tickets from integration gaps.
summary: Runs the cross-sidecar analysis workflow equivalent to the provisioned /cross-analyze command and records findings as canonical tickets.
version: 1.0.0
author: Ragomez33
license: MIT
tags: [analysis, tickets, multi-repo, orchestration]
keywords: [brain-corp, cross-analyze, analysis, tickets, system-map, integration-gaps]
use_cases: [Detect integration gaps between repositories, Audit contracts and schemas, Create actionable tickets from findings]
docs_url: https://github.com/Ragomez33/brain-corp#readme
compatibility: Requires Node.js 18+, npm/npx and git. Network access is needed for npx.
---

# brain-corp analysis

Use this skill when the user wants to analyze the ecosystem and create tickets. It is the Agensi equivalent of the provisioned `/cross-analyze` command.

Read `../shared/cli-contract.md` and `../shared/language-boundary.md` first.

## Prerequisites

```bash
command -v brain
brain --version
```

If `brain` is missing, use `npx @rgkoko/brain-corp@2.0.0 <command>`.

Ensure the workspace assets exist:

- `.agents/prompts/analyst.md`
- `.agents/tickets/backlog/`
- `config/system-map.json`

If `.agents/prompts/analyst.md` is missing, ask the user to run `brain agents:sync` or run the npx equivalent.

## Workflow

1. **Load the analyst directives.**

   Read `.agents/prompts/analyst.md` (or `templates/agents/<lang>/prompts/analyst.md` if the workspace is not provisioned). Apply its role, environment knowledge, analysis protocol and ticket format.

   If the provisioned `.opencode/commands/cross-analyze.md` (or the Claude equivalent) exists, follow that command as well.

2. **Read the topology.**

   Read `config/system-map.json` and use `repositories[]`, `role`/`kind`, `path`, `stack`, `domains` and `relationships` as the starting point.

3. **Inspect the relevant repositories.**

   For each repository affected by the topic:

   - `provider`: data schema → contract/API → resolvers and validations.
   - `client`: API client → services → views/components.
   - `standalone`: local persistence → services → external integrations.

   Look for models without endpoints, endpoints without consumers, inconsistent fields/enums/types, client views without provider support, and cross-sidecar integration gaps.

4. **Avoid duplicates.**

   Review `.agents/tickets/backlog/`, `in-analysis/`, `ready/` and `done/`. If the finding already exists, update or reference the existing ticket instead of creating a new one.

5. **Create the ticket.**

   Write a Markdown file in `.agents/tickets/backlog/` named `TICK-XXX-<slug>.md` using the next three-digit sequence.

   Strict frontmatter:

   ```yaml
   ---
   id: "TICK-XXX"
   title: "Descriptive title"
   author: "Brain-Corp Analyst"
   target_domain: "<repository-id> | shared"
   status: "backlog"
   created_at: "YYYY-MM-DD"
   dependencies: []
   ---
   ```

   Body sections (workspace language for prose; canonical headers):

   - `## Context / Finding`
   - `## Technical Requirements`
   - `## Architecture Impact`

   Legacy Spanish headers are accepted if the ticket is written in Spanish.

6. **Validate.**

   ```bash
   brain sanity --write
   ```

7. **Report.**

   Return the ticket path, ID, title, `target_domain` and the main finding in 1–2 sentences.

## Guardrails

- Cite real file paths, models and fields as evidence.
- Do not propose complete product code; describe contracts, signatures and acceptance criteria.
- Do not modify product code during analysis.
- Do not invent tickets, domains or evidence.
- Do not commit or push.
- Keep engine output in English and write ticket prose in the workspace language.
