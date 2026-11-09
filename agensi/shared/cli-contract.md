# brain-corp CLI contract

These skills use the published npm package as the execution engine:

- Package: `@rgkoko/brain-corp`
- Pinned version: `2.0.0`
- Binary: `brain`
- Requires: Node.js >= 18, npm/npx, git, and `gh` for GitHub workflows.

## 1. Detect the CLI

Run:

```bash
command -v brain
brain --version
```

If `brain` is missing, prefer the pinned `npx` fallback:

```bash
npx @rgkoko/brain-corp@2.0.0 <command> [options]
```

Examples:

```bash
npx @rgkoko/brain-corp@2.0.0 setup
npx @rgkoko/brain-corp@2.0.0 init-work TICK-001
```

Only install globally after explicit user approval:

```bash
npm install -g @rgkoko/brain-corp@2.0.0
```

Never install a different or unpinned version unless the user asks for it.

## 2. Operate from the workspace root

- The workspace root is the current directory.
- Never `cd` into a sidecar or repository.
- Resolve repository paths from `config/system-map.json`.
- Pass a subdirectory only through `workdir`/`cwd` when a tool requires it.

## 3. Safe execution rules

- Never run `git commit`, `git push`, `git merge` or open a PR without explicit user authorization.
- `brain hotfix` may create a branch; it never commits or pushes.
- `brain pr` creates a pull request only if the branch already exists on the remote; it never commits or pushes.
- Do not invent ticket IDs, repository IDs, licenses or command output.
- If a command fails, report the exact error and stop the affected workflow.
- Do not delete tickets that have a `github_issue` unless the user explicitly authorizes it.

## 4. GitHub dependency

Commands that use GitHub require an authenticated `gh` session:

```bash
gh auth status
```

If it fails, ask the user to run `gh auth login`. Never handle tokens directly.
