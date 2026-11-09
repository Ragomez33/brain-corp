# Publishing brain-corp Agent Skills on Agensi

This folder is the upload artifact for Agensi. It is a **skill pack**: it contains five `SKILL.md` files, so Agensi detects a pack automatically.

## 1. Validate the package locally

```bash
cd agensi
find . -name SKILL.md
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log('manifest ok')"
```

Expected skills:

- `skills/brain-corp-setup/SKILL.md`
- `skills/brain-corp-analysis/SKILL.md`
- `skills/brain-corp-sdd/SKILL.md`
- `skills/brain-corp-ticket-ops/SKILL.md`
- `skills/brain-corp-pr/SKILL.md`

Ensure there are no secrets, `.env` files, `node_modules` or OS metadata.

## 2. Build the ZIP

From the repository root:

```bash
cd agensi
zip -r ../brain-corp-agent-skills.zip . -x "*.DS_Store" -x "__MACOSX/*"
```

Upload `brain-corp-agent-skills.zip` in the Agensi seller dashboard.

## 3. Listing metadata

Suggested values:

- **Name:** brain-corp Agent Skills
- **Type:** Skill pack
- **Category:** Workflow Automation
- **Description:** Orchestrate multi-repository SDD, tickets and pull requests with the `@rgkoko/brain-corp` CLI.
- **Version:** 1.0.0
- **License:** MIT
- **Docs URL:** https://github.com/Ragomez33/brain-corp#readme
- **Needs access to:** shell, network, Node.js/npm, git, GitHub CLI (`gh`)

## 4. Review checklist

Before submitting:

- [ ] `brain --version` or `npx @rgkoko/brain-corp@1.1.2 --version` is verified.
- [ ] Every `SKILL.md` starts with valid YAML frontmatter and has `name` and `description`.
- [ ] The pack contains no credentials, tokens, private keys or absolute user paths.
- [ ] The CLI version in the skills matches the published npm version.
- [ ] `brain pr` is documented as “no commit, no push”.
- [ ] Spanish/English behavior follows `shared/language-boundary.md`.
- [ ] A dry run of each workflow was tested with a real agent.

## 5. Updating the pack

When the npm engine changes:

1. Update `manifest.json` → `engine.version`.
2. Update the pinned `npx @rgkoko/brain-corp@<version>` references in each `SKILL.md`.
3. Bump `version` in every `SKILL.md` and in `manifest.json`.
4. Rebuild the ZIP and upload a new version.
