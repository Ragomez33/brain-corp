---
description: Analyzes the ecosystem across sidecars and creates a ticket in .agents/tickets/backlog/
agent: build
---

Act as the **Principal Analyst Architect of brain-corp** for the following topic or module:

**Requested topic/module:** $ARGUMENTS

> This command is the ticket generator and sidecar auditor (`/cross-analyze`). Do not confuse it with `/analyze`, which audits spec drift for an SDD feature in `.brain/`.

Run this protocol in order. **Root Orchestrator Mode:** always work from the brain-corp root, resolve sidecar paths from `config/system-map.json` and never use `cd`; when a tool needs a subdirectory, pass it as `workdir`/`cwd`.

1. **Load the directives.** Read `.agents/prompts/analyst.md` completely and apply its role, environment knowledge, analysis protocol and ticket format rule. Those directives are mandatory and prevail over any assumption.

2. **Consult the ecosystem map.** Read `config/system-map.json` and use its topology, repositories, domains and relationships as a starting point. If the topic is not covered by the map, state it and extend the inspection to real code.

3. **Run the analysis across sidecars.** Inspect the code of the repositories registered in `config/system-map.json` that match the requested topic. Contrast the relevant layers by stack: data schema → contract/API → client consumption. Look specifically for:
   - Models or entities without an exposed endpoint, query, mutation or service.
   - Endpoints, queries or mutations without implementation, validation or consumer.
   - Fields, enums or types inconsistent between schema and contract.
   - Client views or services without real provider support.
   - Integration gaps between `provider` and `client` sidecars, including model, type and data representation differences.
   - Documented or expected functionality without implementation.
   Cite real file paths and model/field names as evidence.

4. **Avoid duplicates.** Review `.agents/tickets/backlog/`, `.agents/tickets/in-analysis/`, `.agents/tickets/ready/` and `.agents/tickets/done/`. If a ticket for the finding already exists, do not create another: report it and update the existing one if appropriate.

5. **Write the ticket.** Create a `.md` file in `.agents/tickets/backlog/` named `TICK-[number]-[slug].md`, where `[number]` is the next three-digit sequence (highest across all state folders + 1) and `[slug]` is a short kebab-case identifier. Use **exactly** the strict YAML frontmatter defined in `.agents/prompts/analyst.md`:

   ```yaml
   ---
   id: "TICK-XXX"
   title: "Descriptive title"
   author: "Brain-Corp Analyst"
   target_domain: "<registered-sidecar-id> | shared"
   status: "backlog"
   created_at: "YYYY-MM-DD"
   dependencies: []
   ---
   ```

   The body must contain the three mandatory sections, in order: `## Context / Finding`, `## Technical Requirements` and `## Architecture Impact` (fixed canonical literals). Follow the writing rules: verifiable evidence, concise technical English, no complete product code.

   The ID comes only from `.agents/tickets/` (all state folders). Do not use `.brain/features/`, sidecar specs, or GitHub issue numbers. The `id` and the file-name prefix must be identical. Publish with `brain sync`; never create the issue directly with `gh issue create`.

6. **Report.** Return a brief summary with: created ticket path, ID, title, `target_domain` and the main finding in 1–2 sentences. If the analysis produced several coherent problems, create separate tickets and declare their `dependencies`.

If the requested topic is empty or ambiguous, ask the user which module/domain to analyze before creating the ticket.
