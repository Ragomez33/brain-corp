# brain-corp Agent Skills

An official skill pack for **brain-corp**, the orchestration CLI for multi-repository ecosystems. The pack teaches an agent how to drive the published `@rgkoko/brain-corp@2.0.0` engine through onboarding, Spec-Driven Development, ticket operations and pull request creation.

- **Engine:** [`@rgkoko/brain-corp@2.0.0`](https://www.npmjs.com/package/@rgkoko/brain-corp)
- **Source:** [github.com/Ragomez33/brain-corp](https://github.com/Ragomez33/brain-corp)
- **License:** MIT

## Included skills

| Skill | Purpose |
| --- | --- |
| `brain-corp-setup` | Register sidecars, choose the workspace language and initialize the CLI session. |
| `brain-corp-analysis` | Analyze the ecosystem and create actionable tickets from integration gaps. |
| `brain-corp-sdd` | Run the native SDD flow: `init-work`, `specify`, `plan`, `tasks`, `implement`, `analyze`. |
| `brain-corp-ticket-ops` | Import, normalize, validate, sync, close and hotfix tickets. |
| `brain-corp-pr` | Create a pull request from a ticket with the bundled EN/ES template. |

## Requirements

- Node.js 18+
- npm / npx
- git
- GitHub CLI (`gh`) authenticated for setup, sync and pull request workflows
- Network access for `npx` if the `brain` binary is not installed globally

The skills check for the `brain` binary and fall back to:

```bash
npx @rgkoko/brain-corp@2.0.0 <command>
```

Global installation is only suggested after user approval:

```bash
npm install -g @rgkoko/brain-corp@2.0.0
```

## Usage

1. Connect your agent to the Agensi MCP.
2. Ask for a brain-corp workflow, for example:
   - “Set up a brain-corp workspace with these repositories.”
   - “Start the SDD work for TICK-014.”
   - “Sync the ticket backlog with GitHub Issues.”
   - “Open a pull request for TICK-014.”
3. The agent loads the matching skill and runs the CLI from the workspace root.

## Language behavior

- Execution instructions, CLI diagnostics, logs and errors remain in **technical English**.
- Specs, plans, tasks, tickets and PR prose follow the workspace `language` (`en` or `es`).
- Canonical English ticket headers are preferred; legacy Spanish headers are accepted for compatibility.

See `shared/language-boundary.md` for the full rule set.

## Safety

- No tokens, private keys or credentials are embedded in the skills.
- GitHub authentication is delegated to `gh`.
- The skills do not commit, push, merge or force-push automatically.
- `brain pr` requires the branch to exist on the remote; it only creates the pull request.

## Limitations

- The CLI must be executable on the buyer's machine via `npx` or a global install.
- Interactive commands such as `brain setup` and `brain init` require user input; the agent must not invent answers.
- GitHub workflows require a valid `gh` session.
- Audit commands run natively for any user; no license or activation step is required.

## Support

- Documentation: [github.com/Ragomez33/brain-corp](https://github.com/Ragomez33/brain-corp)
- Package: [npmjs.com/package/@rgkoko/brain-corp](https://www.npmjs.com/package/@rgkoko/brain-corp)
