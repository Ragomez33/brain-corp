const { DEFAULT_LANGUAGE, resolveLanguage } = require('./config')

const MESSAGES = {
  en: {
    'language.prompt': 'Select your preferred language / Selecciona tu idioma',
    'language.en': 'English (Recommended for technical consistency & AI parsing)',
    'language.es': 'Español',
    'language.saved': 'Language set to {lang}.',
    'language.invalid': 'Invalid language. Use "en" or "es".',

    'bin.title': 'brain-corp v{version}',
    'bin.usage': 'Usage:\n  brain [command] [options]\n\nCommands:',
    'bin.options': 'Options:\n  -h, --help       Show this help.\n  -v, --version    Show the version.\n\nWithout a command, brain runs "init".',
    'bin.unknown': 'Unknown command: {name}',

    'bin.cmd.init': 'Onboarding, session and agent launch.',
    'bin.cmd.start': 'Alias of init.',
    'bin.cmd.setup': 'Register sidecars and ecosystem topology.',
    'bin.cmd.agentsSync': 'Redeploy agent assets and commands.',
    'bin.cmd.audit': 'Enterprise audits (license required).',
    'bin.cmd.initWork': 'Initialize an SDD feature in .brain/.',
    'bin.cmd.specify': 'Generate spec.md (EARS).',
    'bin.cmd.plan': 'Generate plan.md.',
    'bin.cmd.tasks': 'Generate tasks.md.',
    'bin.cmd.implement': 'Run tasks (checkpoint or batch).',
    'bin.cmd.analyze': 'Audit coherence and spec drift.',
    'bin.cmd.sync': 'Publish backlog tickets as issues.',
    'bin.cmd.syncPull': 'Import GitHub issues as tickets.',
    'bin.cmd.pull': 'Alias of sync:pull.',
    'bin.cmd.sanity': 'Audit ticket coherence.',
    'bin.cmd.watch': 'Continuous synchronization.',
    'bin.cmd.normalize': 'Normalize imported tickets.',
    'bin.cmd.complete': 'Close a ticket delivery.',
    'bin.cmd.hotfix': 'Create an emergency ticket.',

    'init.agentsHeading': 'Agent CLI engine for this session',
    'init.customAgentPrompt': 'Custom agent name',
    'init.selectOption': 'Select an option',
    'init.customAgentLabel': 'Custom',
    'init.defaultSuffix': '(default)',
    'init.projectPrompt': 'Project ID or GitHub Project Kanban URL (empty to skip)',
    'init.projectFormat': '  Unrecognized format. Use a number or a URL like https://github.com/orgs/MyOrg/projects/5',
    'init.projectOwnerPrompt': 'Project owner (user or organization)',
    'init.projectWarning': '  Warning: could not verify the Project (missing "project" scope?). It will be saved anyway.',
    'init.syncPull': 'Syncing tickets from GitHub (sync-pull)...',
    'init.syncPullFailed': '[init-brain] sync-pull could not complete. Continuing with local state.',
    'init.watcherActive': 'Watcher already active (PID {pid}).',
    'init.watcherPrompt': 'Enable real-time watcher (every 45s)?',
    'init.watcherOff': 'Watcher not enabled.',
    'init.watcherStarted': 'Watcher started in background (PID {pid}). Log: {log}',
    'init.onboardingTitle': '=== brain-corp · Initial onboarding ===',
    'init.githubUserDetected': 'GitHub user detected: {user}',
    'init.configSaved': 'Configuration saved to .brainrc.json:',
    'init.githubUser': 'GitHub user',
    'init.project': 'Project',
    'init.defaultAgent': 'Default agent',
    'init.notConfigured': 'not configured',
    'init.sessionTitle': '=== brain-corp · Session ===',
    'init.user': 'User',
    'init.focusPrompt': 'Session focus (module, task or sidecar; empty = global analysis)',
    'init.globalAnalysis': 'global analysis',
    'init.sessionConfigured': 'Session configured:',
    'init.agent': 'Agent',
    'init.focus': 'Focus',
    'init.suggestion': 'Suggestion: use /cross-analyze <topic> to open a ticket or /init-work <TICK-XXX> to start its SDD spec in .brain/features/.',
    'init.watcherStopped': 'Watcher stopped (PID {pid}).',
    'init.watcherStopError': '[init-brain] Could not stop watcher (PID {pid}): {error}',
    'init.launching': 'Launching {agent}...',
    'init.workspaceMissing': '[init-brain] Unconfigured workspace: no config/system-map.json with valid sidecars.',
    'init.setupStarting': '[init-brain] Starting setup wizard in the current directory...',
    'init.sidecarsMissing': 'The workspace still has no sidecars configured. Run "brain setup" in this directory before starting the session.',
    'init.assetsVerified': '[init-brain] Agent assets verified: {created} new file(s), {skipped} already existing.',
    'init.assetsDeployed': '[init-brain] Prompts/skills/SDD templates deployed to {dir}.',
    'init.launchError': 'Could not launch agent "{agent}": {error}. Check it is installed and available in PATH.',
    'init.ghMissing': 'GitHub CLI (gh) not found. Install it from https://cli.github.com/.',
    'init.ghFailed': 'Command "gh {command}" failed.',
    'init.ghSession': 'GitHub CLI has no active session. Run "gh auth login" and try again.',
    'init.ghUser': 'Could not get the authenticated GitHub user.',
    'init.badConfig': '.brainrc.json exists but is not valid JSON: {error}',

    'sdd.help': `brain SDD (.brain/)

Usage:
  node scripts/sdd.js <command> <TICK-XXX> [options]

Commands:
  init-work   Create .brain/features/<ticket>/ and contract if it crosses sidecars.
  specify     Generate spec.md in EARS format.
  plan        Generate plan.md.
  tasks       Generate tasks.md.
  implement   Guide task execution (checkpoint or batch).
  analyze     Audit coherence and detect spec drift.

Options:
  --repo <id>        Base repository (required if ticket is "shared").
  --force            Overwrite the phase file if it exists.
  --mode <mode>      implement: checkpoint (default) | batch.
  --complete <TID>   implement: mark a task as completed.
  --no-write         analyze: do not write analysis.md.
  --json             JSON output.
  --help             Show this help.`,
    'sdd.unknownCommand': 'Unknown command: {name}. Use: {commands}.',
    'sdd.missingTicket': 'Missing ticket for "{command}". Usage: brain {command} TICK-XXX.',
    'sdd.failMissingValue': 'Missing value for {option}',
    'sdd.failUnknownOption': 'Unknown option: {option}',
    'sdd.featureInitialized': '[sdd] Feature {ticket} initialized at {dir}',
    'sdd.repository': '[sdd] Repository: {repo} ({domain})',
    'sdd.templates': '[sdd] Templates: {created} new, {skipped} existing.',
    'sdd.contractCreated': '[sdd] contract.md generated (cross-sidecar integration detected).',
    'sdd.contractExists': '[sdd] contract.md already existed.',
    'sdd.nextInit': '[sdd] Next: brain specify {ticket}',
    'sdd.generated': '[sdd] Generated {file}',
    'sdd.exists': '[sdd] Already exists {file} (use --force to regenerate).',
    'sdd.next': '[sdd] Next: brain {command} {ticket}',
    'sdd.noPending': '[sdd] No pending tasks.',
    'sdd.batchPending': '[sdd] Batch: {count} pending task(s).',
    'sdd.taskCompleted': '[sdd] Task {task} marked as completed.',
    'sdd.nextTask': '[sdd] Next task: {id}',
    'sdd.completeHint': '[sdd] When done: brain implement {ticket} --complete {id}',
    'sdd.analysisStatus': '[sdd] Analysis {ticket}: {status}',
    'sdd.analysisMetrics': '[sdd] Requirements: {requirements} · tasks: {done}/{total} completed.',
    'sdd.analysisReport': '[sdd] Report: {file}',

    'audit.help': `brain-corp · Enterprise audits

Usage:
  brain audit <audit> [options]

Audits (require Enterprise license):
  dead-code       Detect orphan exports and estimate bundle savings.
  debt-radar      TODO/FIXME/any markers with git age and cross-sidecar friction.
  contract-guard  Prevent breaking changes in schemas and contract.md.
  security-scan   Compare active EARS spec requirements with code controls.

Options:
  --root <dir>     Workspace root (defaults to current directory).
  --repo <id>      Limit the audit to a system-map repository.
  --ticket <id>    security-scan: use a specific feature.
  --json           Emit the report as JSON.
  --help           Show this help.

License activation:
  export BRAIN_LICENSE_TOKEN="<payload>.<signature>"
  or set { "enterpriseLicense": "..." } in ~/.brain/config.json`,
    'audit.unknown': 'Unknown audit: {name}',
    'audit.buildMissing': 'Enterprise build not found in dist/. Run "npm run build". ({error})',
    'audit.noFindings': 'No findings.',
    'audit.missingValue': 'Missing value for {option}',
    'audit.unknownOption': 'Unknown option: {option}',
    'audit.licenseReason': 'Reason: {reason}',

    'hotfix.missingValue': 'Missing value for {option}',
    'hotfix.unknownArg': 'Unrecognized argument: {arg}',
    'hotfix.missingTitle': 'Missing --title (hotfix title).',
    'hotfix.missingDomain': 'Missing --domain (registered sidecar id or "shared").',
    'hotfix.missingModule': 'Missing --module (commit module, e.g. inventory).',
    'hotfix.missingSpecImpact': 'Missing --spec-impact. Use "none" or a reference to the spec/tasks.md amendment.',
    'hotfix.sharedRepoRequired': 'Domain "shared" requires --repo with the sidecar or "root" for brain-corp.',
    'hotfix.readMapError': 'Could not read config/system-map.json: {error}',
    'hotfix.noRepoForDomain': 'No repository configured for domain {domain}. Use --repo.',
    'hotfix.maxTickets': 'No TICK IDs left (maximum TICK-999).',
    'hotfix.invalidDomain': 'Invalid domain: {domain}. Register the sidecar in config/system-map.json or use one of: {domains}.',
    'hotfix.notGitRepo': 'Path {path} is not a valid git repository.',
    'hotfix.dirtyRepo': '[hotfix] Repository {repo} has uncommitted changes; the branch will be created on the current state.',
    'hotfix.ticketCreated': '[hotfix] Ticket created: {ticket}',
    'hotfix.dryRunTicket': '[hotfix] dry-run: ticket was not written.',
    'hotfix.branch': '[hotfix] Branch: {branch} ({repo})',
    'hotfix.suggestedCommit': '[hotfix] Suggested commit: {commit}',
    'hotfix.specImpact': '[hotfix] Spec impact: {impact}',
    'hotfix.next': '[hotfix] Next: node scripts/sanity-check.js --write',
    'hotfix.issueCreated': '[hotfix] Issue #{issue} created.',
    'hotfix.branchError': '[hotfix] Error creating branch: {error}',
    'hotfix.publishError': '[hotfix] Error publishing issue: {error}',

    'complete.missingValue': 'Missing value for {option}',
    'complete.unknownArg': 'Unrecognized argument: {arg}',
    'complete.ticketRequired': 'You must provide a ticket. Usage: node scripts/complete-ticket.js TICK-014 [PR]',
    'complete.notFound': 'Ticket {ticket} not found in .agents/tickets/.',
    'complete.ambiguous': 'Ticket {ticket} is ambiguous; it matches several files:\n  - {paths}',
    'complete.done': '[complete-ticket] {ticket} marked as done -> {path}',
    'complete.prRegistered': '[complete-ticket] PR registered: {pr}',
    'complete.issueClosed': '[complete-ticket] Issue #{issue} closed on GitHub.',
    'complete.issueCloseError': '[complete-ticket] Could not close issue #{issue}: {error}',
    'complete.issueCloseSkipped': '[complete-ticket] Issue close skipped: {reason}',
    'complete.reasonNoIssue': 'The ticket has no github_issue.',
    'complete.reasonSkipClose': 'Close skipped with --skip-close.',
    'complete.reasonDryRun': 'dry-run: gh issue close was not executed.',
    'complete.reasonAlreadyClosed': 'The issue was already closed.',

    'normalize.unknownArg': 'Unrecognized argument: {arg}',
    'normalize.none': '[normalize-ticket] No tickets with status "needs_formatting".',
    'normalize.pending': '[normalize-ticket] {count} pending ticket(s):\n',
    'normalize.issue': 'issue',
    'normalize.noIssue': 'no issue',
    'normalize.title': 'title',
    'normalize.noTitle': '(no title)',
    'normalize.domain': 'inferred domain',
    'normalize.preview': 'preview',
    'normalize.noIssueNumber': 'Could not determine the issue number for {file}',
    'normalize.issueUpdated': '[normalize-ticket] Issue #{issue} updated from {file}.',
    'normalize.normalized': '[normalize-ticket] {file} -> {domain}{suffix}',
    'normalize.issueSuffix': ' (issue #{issue} updated)',
    'normalize.itemError': '[normalize-ticket] {file}: error -> {error}',
    'normalize.summary': '[normalize-ticket] Summary: {normalized} normalized, {failed} failed.',
    'normalize.sharedImpact': 'shared contracts between sidecars, data mapping and potential integrations.',
    'normalize.repoImpact': 'repository `{repo}`.',
    'normalize.repoImpactDetail': 'repository `{repo}`{role}{stack}.',

    'sync.configMissing': '[sync-github] .brainrc.json does not exist. Run "npm run init-brain". Global flags/env vars will be used if present.',
    'sync.badConfig': '.brainrc.json is not valid JSON: {error}',
    'sync.missingValue': 'Missing value for {option}',
    'sync.unknownArg': 'Unrecognized argument: {arg}',
    'sync.ghMissing': 'GitHub CLI (gh) not found. Install it from https://cli.github.com/ and run "gh auth login".',
    'sync.ghSession': 'GitHub CLI has no active session. Run "gh auth login".',
    'sync.sanitySkipped': '[sync-github] Sanity check skipped by explicit configuration.',
    'sync.sanityWarn': '[sync-github] Sanity WARN: {warning}',
    'sync.sanityBlocked': 'The sanity check blocked synchronization with {count} error(s):\n{details}\nFix the tickets or run with --skip-sanity.',
    'sync.sanityOk': '[sync-github] Sanity check OK: {count} backlog ticket(s) ready to sync.',
    'sync.ticketsDirMissing': 'Tickets directory not found: {dir}',
    'sync.labelError': '[sync-github] Could not ensure label "{label}": {error}',
    'sync.projectOwnerMissing': '[sync-github] Add to Project requested, but the owner could not be determined. Use --owner or GITHUB_PROJECT_OWNER.',
    'sync.projectAdded': '[sync-github] Issue added to Project {project}.',
    'sync.projectAddError': '[sync-github] Could not add the issue to the Project: {error}',
    'sync.frontmatterUnclosed': 'Unclosed YAML frontmatter in {file}',
    'sync.projectConfigured': '[sync-github] Project configured: #{project} (owner: {owner}).',
    'sync.ownerUnknown': 'unknown',
    'sync.noTickets': '[sync-github] No tickets in backlog/. Nothing to synchronize.',
    'sync.alreadyHasIssue': '[sync-github] {file}: already has issue #{issue}, skipped.',
    'sync.issueNumberError': 'Could not extract the issue number from gh output: {output}',
    'sync.issueCreated': '[sync-github] {file}: issue #{issue} created ({url}).',
    'sync.issueCreateError': '[sync-github] {file}: error creating issue -> {error}',
    'sync.summary': '[sync-github] Summary: {created} created, {skipped} skipped, {failed} failed.',

    'setup.help': `brain-corp setup-wizard

Usage:
  node scripts/setup-wizard.js [options]

Options:
  --manual   Skip the GitHub API and register repositories by URL or local path.
  --force    Ask again even if sidecars are already configured.
  --help     Show this help.

Flow:
  1. Query all accessible repositories (personal and organizations) with:
     gh api --paginate user/repos?per_page=100 --jq "<fields>"
  2. If there are many repositories, allow filtering by organization.
  3. Show a multi-select menu: arrows to move, space to select
     and Enter to confirm.
  4. Assign a role (provider | client | standalone) to each selection.
  5. Generate config/system-map.json with sidecars/<repo-name> paths.
  6. Offer to clone with "gh repo clone <owner/repo> <path>".
  If gh is not authenticated or fails, the wizard continues in manual mode.`,
    'setup.unknownArg': 'Unrecognized argument: {arg}',
    'setup.rolePrompt': 'Sidecar role',
    'setup.roleProvider': 'provider (provides data/API to other sidecars)',
    'setup.roleClient': 'client (consumes data/API from a provider)',
    'setup.roleStandalone': 'standalone (operates autonomously)',
    'setup.roleHeading': 'Sidecar role:',
    'setup.selectOption': 'Select an option',
    'setup.roleFallback': '  Unrecognized option; "standalone" will be used.',
    'setup.rangeOutOfList': 'Range out of list: {part}',
    'setup.invalidSelection': 'Invalid selection: {part}',
    'setup.githubReposHeading': 'Repositories available on GitHub:',
    'setup.private': 'private',
    'setup.public': 'public',
    'setup.selectReposPrompt': 'Select repositories ({count} available)',
    'setup.manualSelectionPrompt': 'Select repositories by number (e.g. 1,3-5), "all", "none" or "manual"',
    'setup.filterOwnersPrompt': '{repos} repositories from {owners} organizations. Filter by organization',
    'setup.ownersHeading': 'Organizations found:',
    'setup.allOwners': 'All',
    'setup.filterOwnersInput': 'Filter by organization (number or empty for all)',
    'setup.conflict': '  Name conflict: {name} is already represented by {existing}. Skipped to keep sidecars/{id}.',
    'setup.assigned': '  Assigned: {id} ({role}) -> {path}',
    'setup.manualHeading': 'Manual registration: use a GitHub URL (https://github.com/owner/repo or git@github.com:owner/repo.git) or an existing local path.',
    'setup.manualInputPrompt': 'GitHub URL or local path (empty to finish)',
    'setup.registered': '  Registered: {id} ({role}) -> {path}',
    'setup.manualMode': 'Manual mode enabled (--manual).',
    'setup.queryingGithub': 'Querying all accessible repositories with GitHub CLI...',
    'setup.githubQueryError': '[setup-wizard] Could not query GitHub: {error}',
    'setup.continueManual': 'Continuing with manual registration by URL or local path.',
    'setup.githubNoRepos': 'GitHub returned no repositories for this account.',
    'setup.addManualPrompt': 'Add a repository by URL or local path too?',
    'setup.ghUnavailableClone': '[setup-wizard] gh is unavailable or has no active session; automatic cloning is skipped.',
    'setup.reposWithoutLocal': 'Selected repositories without a local copy:',
    'setup.clonePrompt': 'Clone them now with "gh repo clone"?',
    'setup.cloning': 'Cloning {repo} into {path}...',
    'setup.cloneExists': '  Already existed locally; skipped.',
    'setup.cloneOk': '  Cloned successfully.',
    'setup.cloneError': '  Could not clone: {error}',
    'setup.noSidecars': 'No sidecars registered in config/system-map.json.',
    'setup.registeredHeading': 'Registered sidecars:',
    'setup.roleLabel': 'Role',
    'setup.pathLabel': 'Path',
    'setup.originLabel': 'Origin',
    'setup.readlineRequired': 'runSetupWizard requires an active readline interface.',
    'setup.onboardingTitle': '=== brain-corp · Sidecar onboarding ===',
    'setup.assetsDeployed': '[setup-wizard] Base assets deployed: {count} new file(s) in .agents/, .brain/templates/ and commands.',
    'setup.alreadyConfigured': 'Sidecars are already configured in config/system-map.json.',
    'setup.addSidecarsPrompt': 'Register additional sidecars?',
    'setup.registerPrompt': 'Do you want to register repositories/sidecars in this workspace?',
    'setup.workspaceNoSidecars': 'Workspace initialized without sidecars. You can register them later with "brain setup".',
    'setup.replacePrompt': 'The current configuration does not seem to match this workspace. Replace the sidecar list?',
    'setup.nextStep': 'Next step: "brain init" or "npm run init-brain".',

    'syncpull.unknownArg': 'Unrecognized argument: {arg}',
    'syncpull.badConfig': '.brainrc.json is not valid JSON: {error}',
    'syncpull.ghSession': 'GitHub CLI has no active session. Run "gh auth login".',
    'syncpull.updated': '[sync-pull] #{issue}: updated to "{status}" -> {path}',
    'syncpull.newTicket': '[sync-pull] #{issue}: new ticket "{status}"{suffix} -> {path}',
    'syncpull.newTicketSuffix': ' (needs_formatting)',
    'syncpull.summary': '[sync-pull] Summary: {created} created, {updated} updated, {unchanged} unchanged ({issues} issues on GitHub).',

    'sanity.reportWritten': '[sanity-check] Report written to {path}',
    'sanity.tickets': '[sanity-check] Tickets: {tickets} (backlog: {backlog})',
    'sanity.warn': '[sanity-check] WARN  {warning}',
    'sanity.error': '[sanity-check] ERROR {error}',
    'sanity.ready': 'READY FOR SYNC',
    'sanity.blocked': 'BLOCKED',
    'sanity.summary': '[sanity-check] {status} — {errors} errors, {warnings} warnings.',

    'watch.unknownArg': '[watch-github] Unrecognized argument: {arg}',
    'watch.invalidInterval': '[watch-github] The interval must be a positive number of seconds.',

    'prompts.cancelled': 'cancelled',
    'prompts.selected': '{count} selected',
    'prompts.none': 'no selection',

    'agents.help': `brain-corp agents:sync

Usage:
  node scripts/sync-agents.js [options]

Options:
  --root <dir>     Target workspace (defaults to current directory).
  --agent <id>     Target engine: {agents}.
  --overwrite      Overwrite existing workspace assets.
  --json           Print the result as JSON.
  --help           Show this help.

Without --agent, uses defaultAgent from .brainrc.json (or "{default}").
Redeploys prompts, skills, SDD templates, central constitution and engine commands without opening a session.`,
    'agents.missingValue': 'Missing value for {option}',
    'agents.unknownOption': 'Unknown option: {option}',
    'agents.badConfig': 'Could not read {file}: {error}',
    'agents.missingWorkspace': 'Workspace does not exist: {root}',
    'agents.engine': '[sync-agents] Engine: {agent} · workspace: {root}',
    'agents.summary': '[sync-agents] {created} new file(s), {skipped} already existing.',

    'auth.helpTitle': 'brain-corp · Enterprise audits',
    'auth.helpBody': 'This capability requires an active Enterprise license.',
    'auth.activate': 'Activate your token in one of these ways:',
    'auth.envOption': '1) Environment variable (recommended in CI):',
    'auth.configOption': '2) Local configuration file:',
    'auth.validation': 'Validation is local with an Ed25519 signature. Provide the public key with BRAIN_LICENSE_PUBLIC_KEY, BRAIN_LICENSE_PUBLIC_KEY_FILE or ~/.brain/license-public.pem.',
    'auth.request': 'Request your token from your organization administrator.'
  },
  es: {
    'language.prompt': 'Select your preferred language / Selecciona tu idioma',
    'language.en': 'English (Recommended for technical consistency & AI parsing)',
    'language.es': 'Español',
    'language.saved': 'Idioma configurado: {lang}.',
    'language.invalid': 'Idioma inválido. Usa "en" o "es".',

    'bin.title': 'brain-corp v{version}',
    'bin.usage': 'Uso:\n  brain [comando] [opciones]\n\nComandos:',
    'bin.options': 'Opciones:\n  -h, --help       Muestra esta ayuda.\n  -v, --version    Muestra la versión.\n\nSin comando, brain ejecuta "init".',
    'bin.unknown': 'Comando no reconocido: {name}',

    'bin.cmd.init': 'Onboarding, sesión y lanzamiento del agente.',
    'bin.cmd.start': 'Alias de init.',
    'bin.cmd.setup': 'Registrar sidecars y topología del ecosistema.',
    'bin.cmd.agentsSync': 'Re-desplegar assets y comandos del motor de agente.',
    'bin.cmd.audit': 'Auditorías Enterprise (requiere licencia).',
    'bin.cmd.initWork': 'Inicializar una feature SDD en .brain/.',
    'bin.cmd.specify': 'Generar spec.md (EARS).',
    'bin.cmd.plan': 'Generar plan.md.',
    'bin.cmd.tasks': 'Generar tasks.md.',
    'bin.cmd.implement': 'Ejecutar tareas (checkpoint o batch).',
    'bin.cmd.analyze': 'Auditar coherencia y spec drift.',
    'bin.cmd.sync': 'Publicar tickets del backlog como issues.',
    'bin.cmd.syncPull': 'Importar issues de GitHub como tickets.',
    'bin.cmd.pull': 'Alias de sync:pull.',
    'bin.cmd.sanity': 'Auditar coherencia de tickets.',
    'bin.cmd.watch': 'Sincronización continua.',
    'bin.cmd.normalize': 'Normalizar tickets importados.',
    'bin.cmd.complete': 'Cerrar la entrega de un ticket.',
    'bin.cmd.hotfix': 'Crear un ticket de emergencia.',

    'init.agentsHeading': 'Motor de agente CLI para esta sesión',
    'init.customAgentPrompt': 'Nombre del agente personalizado',
    'init.selectOption': 'Selecciona una opción',
    'init.customAgentLabel': 'Personalizado',
    'init.defaultSuffix': '(por defecto)',
    'init.projectPrompt': 'Project ID o URL del GitHub Project Kanban (vacío para omitir)',
    'init.projectFormat': '  Formato no reconocido. Usa un número o una URL como https://github.com/orgs/MiOrg/projects/5',
    'init.projectOwnerPrompt': 'Propietario del Project (usuario u organización)',
    'init.projectWarning': '  Aviso: no se pudo verificar el Project (puede faltar el scope "project"). Se guardará igualmente.',
    'init.syncPull': 'Sincronizando tickets desde GitHub (sync-pull)...',
    'init.syncPullFailed': '[init-brain] sync-pull no pudo completarse. Se continúa con el estado local.',
    'init.watcherActive': 'Watcher ya activo (PID {pid}).',
    'init.watcherPrompt': '¿Activar watcher en tiempo real (cada 45s)?',
    'init.watcherOff': 'Watcher no activado.',
    'init.watcherStarted': 'Watcher iniciado en segundo plano (PID {pid}). Log: {log}',
    'init.onboardingTitle': '=== brain-corp · Onboarding inicial ===',
    'init.githubUserDetected': 'Usuario de GitHub detectado: {user}',
    'init.configSaved': 'Configuración guardada en .brainrc.json:',
    'init.githubUser': 'GitHub user',
    'init.project': 'Project',
    'init.defaultAgent': 'Agente por defecto',
    'init.notConfigured': 'sin configurar',
    'init.sessionTitle': '=== brain-corp · Sesión ===',
    'init.user': 'Usuario',
    'init.focusPrompt': 'Foco de la sesión (módulo, tarea o sidecar; vacío = análisis global)',
    'init.globalAnalysis': 'análisis global',
    'init.sessionConfigured': 'Sesión configurada:',
    'init.agent': 'Agente',
    'init.focus': 'Foco',
    'init.suggestion': 'Sugerencia: usa /cross-analyze <tema> para abrir un ticket o /init-work <TICK-XXX> para iniciar su spec SDD en .brain/features/.',
    'init.watcherStopped': 'Watcher detenido (PID {pid}).',
    'init.watcherStopError': '[init-brain] No se pudo detener el watcher (PID {pid}): {error}',
    'init.launching': 'Lanzando {agent}...',
    'init.workspaceMissing': '[init-brain] Workspace sin configurar: no hay config/system-map.json con sidecars válidos.',
    'init.setupStarting': '[init-brain] Iniciando setup wizard en el directorio actual...',
    'init.sidecarsMissing': 'El workspace sigue sin sidecars configurados. Ejecuta "brain setup" en este directorio antes de iniciar la sesión.',
    'init.assetsVerified': '[init-brain] Assets del agente verificados: {created} archivo(s) nuevos, {skipped} ya existentes.',
    'init.assetsDeployed': '[init-brain] Prompts/skills/plantillas SDD desplegados en {dir}.',
    'init.launchError': 'No se pudo lanzar el agente "{agent}": {error}. Verifica que esté instalado y disponible en el PATH.',
    'init.ghMissing': 'No se encontró el CLI de GitHub (gh). Instálalo desde https://cli.github.com/.',
    'init.ghFailed': 'El comando "gh {command}" falló.',
    'init.ghSession': 'El CLI de GitHub no tiene una sesión activa. Ejecuta "gh auth login" y vuelve a intentar.',
    'init.ghUser': 'No se pudo obtener el usuario autenticado de GitHub.',
    'init.badConfig': '.brainrc.json existe pero no es JSON válido: {error}',

    'sdd.help': `brain SDD (.brain/)

Uso:
  node scripts/sdd.js <comando> <TICK-XXX> [opciones]

Comandos:
  init-work   Crea .brain/features/<ticket>/ y el contrato si cruza sidecars.
  specify     Genera spec.md en formato EARS.
  plan        Genera plan.md.
  tasks       Genera tasks.md.
  implement   Guía la ejecución de tareas (checkpoint o batch).
  analyze     Audita coherencia y detecta spec drift.

Opciones:
  --repo <id>        Repositorio base (obligatorio si el ticket es "shared").
  --force            Sobrescribe el archivo de la fase si ya existe.
  --mode <modo>      implement: checkpoint (default) | batch.
  --complete <TID>   implement: marca una tarea como completada.
  --no-write         analyze: no escribe analysis.md.
  --json             Salida JSON.
  --help             Muestra esta ayuda.`,
    'sdd.unknownCommand': 'Comando no reconocido: {name}. Usa: {commands}.',
    'sdd.missingTicket': 'Falta el ticket para "{command}". Uso: brain {command} TICK-XXX.',
    'sdd.failMissingValue': 'Falta el valor para {option}',
    'sdd.failUnknownOption': 'Opción desconocida: {option}',
    'sdd.featureInitialized': '[sdd] Feature {ticket} inicializada en {dir}',
    'sdd.repository': '[sdd] Repositorio: {repo} ({domain})',
    'sdd.templates': '[sdd] Plantillas: {created} nuevas, {skipped} existentes.',
    'sdd.contractCreated': '[sdd] contract.md generado (integración entre sidecars detectada).',
    'sdd.contractExists': '[sdd] contract.md ya existía.',
    'sdd.nextInit': '[sdd] Siguiente: brain specify {ticket}',
    'sdd.generated': '[sdd] Generado {file}',
    'sdd.exists': '[sdd] Ya existe {file} (usa --force para regenerar).',
    'sdd.next': '[sdd] Siguiente: brain {command} {ticket}',
    'sdd.noPending': '[sdd] No quedan tareas pendientes.',
    'sdd.batchPending': '[sdd] Batch: {count} tarea(s) pendientes.',
    'sdd.taskCompleted': '[sdd] Tarea {task} marcada como completada.',
    'sdd.nextTask': '[sdd] Siguiente tarea: {id}',
    'sdd.completeHint': '[sdd] Al terminar: brain implement {ticket} --complete {id}',
    'sdd.analysisStatus': '[sdd] Análisis {ticket}: {status}',
    'sdd.analysisMetrics': '[sdd] Requisitos: {requirements} · tareas: {done}/{total} completadas.',
    'sdd.analysisReport': '[sdd] Reporte: {file}',

    'audit.help': `brain-corp · Auditorías Enterprise

Uso:
  brain audit <auditoría> [opciones]

Auditorías (requieren licencia Enterprise):
  dead-code       Detecta exports huérfanos y estima ahorro de bundle.
  debt-radar      Marcadores TODO/FIXME/any con antigüedad git y fricción entre sidecars.
  contract-guard  Previene breaking changes en esquemas y contract.md.
  security-scan   Contrasta requisitos EARS de la spec activa con el código.

Opciones:
  --root <dir>     Raíz del workspace (por defecto, el directorio actual).
  --repo <id>      Limita la auditoría a un repositorio del system-map.
  --ticket <id>    security-scan: usa una feature concreta.
  --json           Emite el reporte en JSON.
  --help           Muestra esta ayuda.

Activación de licencia:
  export BRAIN_LICENSE_TOKEN="<payload>.<firma>"
  o define { "enterpriseLicense": "..." } en ~/.brain/config.json`,
    'audit.unknown': 'Auditoría desconocida: {name}',
    'audit.buildMissing': 'No se encontró el build Enterprise en dist/. Ejecuta "npm run build". ({error})',
    'audit.noFindings': 'Sin hallazgos.',
    'audit.missingValue': 'Falta el valor para {option}',
    'audit.unknownOption': 'Opción desconocida: {option}',
    'audit.licenseReason': 'Motivo: {reason}',

    'hotfix.missingValue': 'Falta el valor para {option}',
    'hotfix.unknownArg': 'Argumento no reconocido: {arg}',
    'hotfix.missingTitle': 'Falta --title (título del hotfix).',
    'hotfix.missingDomain': 'Falta --domain (id de sidecar registrado o "shared").',
    'hotfix.missingModule': 'Falta --module (módulo del commit, ej. inventory).',
    'hotfix.missingSpecImpact': 'Falta --spec-impact. Usa "none" o una referencia a la enmienda de la spec/tasks.md.',
    'hotfix.sharedRepoRequired': 'El dominio "shared" requiere --repo con el sidecar o "root" para brain-corp.',
    'hotfix.readMapError': 'No se pudo leer config/system-map.json: {error}',
    'hotfix.noRepoForDomain': 'No hay repositorio configurado para el dominio {domain}. Usa --repo.',
    'hotfix.maxTickets': 'No quedan IDs TICK disponibles (máximo TICK-999).',
    'hotfix.invalidDomain': 'Dominio inválido: {domain}. Registra el sidecar en config/system-map.json o usa uno de: {domains}.',
    'hotfix.notGitRepo': 'La ruta {path} no es un repositorio git válido.',
    'hotfix.dirtyRepo': '[hotfix] El repositorio {repo} tiene cambios sin commitear; la rama se creará sobre el estado actual.',
    'hotfix.ticketCreated': '[hotfix] Ticket creado: {ticket}',
    'hotfix.dryRunTicket': '[hotfix] dry-run: no se escribió el ticket.',
    'hotfix.branch': '[hotfix] Rama: {branch} ({repo})',
    'hotfix.suggestedCommit': '[hotfix] Commit sugerido: {commit}',
    'hotfix.specImpact': '[hotfix] Spec impact: {impact}',
    'hotfix.next': '[hotfix] Siguiente: node scripts/sanity-check.js --write',
    'hotfix.issueCreated': '[hotfix] Issue #{issue} creado.',
    'hotfix.branchError': '[hotfix] Error al crear la rama: {error}',
    'hotfix.publishError': '[hotfix] Error al publicar el issue: {error}',

    'complete.missingValue': 'Falta el valor para {option}',
    'complete.unknownArg': 'Argumento no reconocido: {arg}',
    'complete.ticketRequired': 'Debes indicar un ticket. Uso: node scripts/complete-ticket.js TICK-014 [PR]',
    'complete.notFound': 'No se encontró el ticket {ticket} en .agents/tickets/.',
    'complete.ambiguous': 'El ticket {ticket} es ambiguo; coincide con varios archivos:\n  - {paths}',
    'complete.done': '[complete-ticket] {ticket} marcado como done -> {path}',
    'complete.prRegistered': '[complete-ticket] PR registrado: {pr}',
    'complete.issueClosed': '[complete-ticket] Issue #{issue} cerrado en GitHub.',
    'complete.issueCloseError': '[complete-ticket] No se pudo cerrar el issue #{issue}: {error}',
    'complete.issueCloseSkipped': '[complete-ticket] Cierre de issue omitido: {reason}',
    'complete.reasonNoIssue': 'El ticket no tiene github_issue.',
    'complete.reasonSkipClose': 'Cierre omitido con --skip-close.',
    'complete.reasonDryRun': 'dry-run: no se ejecutó gh issue close.',
    'complete.reasonAlreadyClosed': 'El issue ya estaba cerrado.',

    'normalize.unknownArg': 'Argumento no reconocido: {arg}',
    'normalize.none': '[normalize-ticket] No hay tickets con status "needs_formatting".',
    'normalize.pending': '[normalize-ticket] {count} ticket(s) pendiente(s):\n',
    'normalize.issue': 'issue',
    'normalize.noIssue': 'sin issue',
    'normalize.title': 'título',
    'normalize.noTitle': '(sin título)',
    'normalize.domain': 'domain inferido',
    'normalize.preview': 'preview',
    'normalize.noIssueNumber': 'No se pudo determinar el número de issue para {file}',
    'normalize.issueUpdated': '[normalize-ticket] Issue #{issue} actualizado desde {file}.',
    'normalize.normalized': '[normalize-ticket] {file} -> {domain}{suffix}',
    'normalize.issueSuffix': ' (issue #{issue} actualizado)',
    'normalize.itemError': '[normalize-ticket] {file}: error -> {error}',
    'normalize.summary': '[normalize-ticket] Resumen: {normalized} normalizados, {failed} con error.',
    'normalize.sharedImpact': 'contratos compartidos entre sidecars, mapeo de datos y posibles integraciones.',
    'normalize.repoImpact': 'repositorio `{repo}`.',
    'normalize.repoImpactDetail': 'repositorio `{repo}`{role}{stack}.',

    'sync.configMissing': '[sync-github] No existe .brainrc.json. Ejecuta "npm run init-brain". Se usarán flags/variables globales si están presentes.',
    'sync.badConfig': '.brainrc.json no es JSON válido: {error}',
    'sync.missingValue': 'Falta el valor para {option}',
    'sync.unknownArg': 'Argumento no reconocido: {arg}',
    'sync.ghMissing': 'No se encontró el CLI de GitHub (gh). Instálalo desde https://cli.github.com/ y ejecuta "gh auth login".',
    'sync.ghSession': 'El CLI de GitHub no tiene una sesión activa. Ejecuta "gh auth login".',
    'sync.sanitySkipped': '[sync-github] Sanity check omitido por configuración explícita.',
    'sync.sanityWarn': '[sync-github] Sanity WARN: {warning}',
    'sync.sanityBlocked': 'El sanity check bloqueó la sincronización con {count} error(es):\n{details}\nCorrige los tickets o ejecuta con --skip-sanity.',
    'sync.sanityOk': '[sync-github] Sanity check OK: {count} ticket(s) de backlog listos para sync.',
    'sync.ticketsDirMissing': 'No existe el directorio de tickets: {dir}',
    'sync.labelError': '[sync-github] No se pudo asegurar la etiqueta "{label}": {error}',
    'sync.projectOwnerMissing': '[sync-github] Se solicitó añadir al Project, pero no se pudo determinar el propietario. Usa --owner o GITHUB_PROJECT_OWNER.',
    'sync.projectAdded': '[sync-github] Issue añadido al Project {project}.',
    'sync.projectAddError': '[sync-github] No se pudo añadir el issue al Project: {error}',
    'sync.frontmatterUnclosed': 'Frontmatter YAML sin cierre en {file}',
    'sync.projectConfigured': '[sync-github] Project configurado: #{project} (owner: {owner}).',
    'sync.ownerUnknown': 'desconocido',
    'sync.noTickets': '[sync-github] No hay tickets en backlog/. Nada que sincronizar.',
    'sync.alreadyHasIssue': '[sync-github] {file}: ya tiene issue #{issue}, se omite.',
    'sync.issueNumberError': 'No se pudo extraer el número de issue de la salida de gh: {output}',
    'sync.issueCreated': '[sync-github] {file}: issue #{issue} creado ({url}).',
    'sync.issueCreateError': '[sync-github] {file}: error al crear el issue -> {error}',
    'sync.summary': '[sync-github] Resumen: {created} creados, {skipped} omitidos, {failed} con error.',

    'setup.help': `brain-corp setup-wizard

Uso:
  node scripts/setup-wizard.js [opciones]

Opciones:
  --manual   Omite la API de GitHub y registra repositorios por URL o ruta local.
  --force    Vuelve a preguntar aunque ya existan sidecars configurados.
  --help     Muestra esta ayuda.

Flujo:
  1. Consulta todos los repositorios accesibles (personales y de organizaciones) con:
     gh api --paginate user/repos?per_page=100 --jq "<campos>"
  2. Si hay muchos repositorios, permite filtrar por organización.
  3. Muestra un menú multi-select: flechas para moverte, espacio para marcar
     y Enter para confirmar.
  4. Permite asignar rol (provider | client | standalone) a cada seleccionado.
  5. Genera config/system-map.json con rutas sidecars/<nombre-repo>.
  6. Ofrece clonar con "gh repo clone <owner/repo> <ruta>".
  Si gh no está autenticado o falla, el wizard continúa en modo manual.`,
    'setup.unknownArg': 'Argumento no reconocido: {arg}',
    'setup.rolePrompt': 'Rol del sidecar',
    'setup.roleProvider': 'provider (provee datos/API a otros sidecars)',
    'setup.roleClient': 'client (consume datos/API de un provider)',
    'setup.roleStandalone': 'standalone (opera de forma autónoma)',
    'setup.roleHeading': 'Rol del sidecar:',
    'setup.selectOption': 'Selecciona una opción',
    'setup.roleFallback': '  Opción no reconocida; se usará "standalone".',
    'setup.rangeOutOfList': 'Rango fuera de la lista: {part}',
    'setup.invalidSelection': 'Selección inválida: {part}',
    'setup.githubReposHeading': 'Repositorios disponibles en GitHub:',
    'setup.private': 'privado',
    'setup.public': 'público',
    'setup.selectReposPrompt': 'Selecciona repositorios ({count} disponibles)',
    'setup.manualSelectionPrompt': 'Selecciona repositorios por número (ej. 1,3-5), "todos", "ninguno" o "manual"',
    'setup.filterOwnersPrompt': '{repos} repositorios de {owners} organizaciones. Filtra por organización',
    'setup.ownersHeading': 'Organizaciones encontradas:',
    'setup.allOwners': 'Todas',
    'setup.filterOwnersInput': 'Filtra por organización (número o vacío para todas)',
    'setup.conflict': '  Conflicto de nombre: {name} ya está representado por {existing}. Se omite para mantener sidecars/{id}.',
    'setup.assigned': '  Asignado: {id} ({role}) -> {path}',
    'setup.manualHeading': 'Registro manual: usa una URL de GitHub (https://github.com/owner/repo o git@github.com:owner/repo.git) o una ruta local existente.',
    'setup.manualInputPrompt': 'URL de GitHub o ruta local (vacío para terminar)',
    'setup.registered': '  Registrado: {id} ({role}) -> {path}',
    'setup.manualMode': 'Modo manual activado (--manual).',
    'setup.queryingGithub': 'Consultando todos los repositorios accesibles con GitHub CLI...',
    'setup.githubQueryError': '[setup-wizard] No se pudo consultar GitHub: {error}',
    'setup.continueManual': 'Se continúa con el registro manual por URL o ruta local.',
    'setup.githubNoRepos': 'GitHub no devolvió repositorios para esta cuenta.',
    'setup.addManualPrompt': '¿Añadir también algún repositorio por URL o ruta local?',
    'setup.ghUnavailableClone': '[setup-wizard] gh no está disponible o no tiene sesión activa; se omite el clonado automático.',
    'setup.reposWithoutLocal': 'Repositorios seleccionados sin copia local:',
    'setup.clonePrompt': '¿Clonarlos ahora con "gh repo clone"?',
    'setup.cloning': 'Clonando {repo} en {path}...',
    'setup.cloneExists': '  Ya existía localmente; se omite.',
    'setup.cloneOk': '  Clonado correctamente.',
    'setup.cloneError': '  No se pudo clonar: {error}',
    'setup.noSidecars': 'No hay sidecars registrados en config/system-map.json.',
    'setup.registeredHeading': 'Sidecars registrados:',
    'setup.roleLabel': 'Rol',
    'setup.pathLabel': 'Ruta',
    'setup.originLabel': 'Origen',
    'setup.readlineRequired': 'runSetupWizard requiere una interfaz readline activa.',
    'setup.onboardingTitle': '=== brain-corp · Onboarding de sidecars ===',
    'setup.assetsDeployed': '[setup-wizard] Assets base desplegados: {count} archivo(s) nuevos en .agents/, .brain/templates/ y comandos.',
    'setup.alreadyConfigured': 'Ya hay sidecars configurados en config/system-map.json.',
    'setup.addSidecarsPrompt': '¿Registrar sidecars adicionales?',
    'setup.registerPrompt': '¿Deseas registrar repositorios/sidecars en este workspace?',
    'setup.workspaceNoSidecars': 'Workspace inicializado sin sidecars. Podrás registrarlos luego con "brain setup".',
    'setup.replacePrompt': 'La configuración actual parece no corresponder a este workspace. ¿Reemplazar la lista de sidecars?',
    'setup.nextStep': 'Siguiente paso: "brain init" o "npm run init-brain".',

    'syncpull.unknownArg': 'Argumento no reconocido: {arg}',
    'syncpull.badConfig': '.brainrc.json no es JSON válido: {error}',
    'syncpull.ghSession': 'El CLI de GitHub no tiene una sesión activa. Ejecuta "gh auth login".',
    'syncpull.updated': '[sync-pull] #{issue}: actualizado a "{status}" -> {path}',
    'syncpull.newTicket': '[sync-pull] #{issue}: nuevo ticket "{status}"{suffix} -> {path}',
    'syncpull.newTicketSuffix': ' (needs_formatting)',
    'syncpull.summary': '[sync-pull] Resumen: {created} creados, {updated} actualizados, {unchanged} sin cambios ({issues} issues en GitHub).',

    'sanity.reportWritten': '[sanity-check] Reporte escrito en {path}',
    'sanity.tickets': '[sanity-check] Tickets: {tickets} (backlog: {backlog})',
    'sanity.warn': '[sanity-check] WARN  {warning}',
    'sanity.error': '[sanity-check] ERROR {error}',
    'sanity.ready': 'READY FOR SYNC',
    'sanity.blocked': 'BLOCKED',
    'sanity.summary': '[sanity-check] {status} — {errors} errores, {warnings} advertencias.',

    'watch.unknownArg': '[watch-github] Argumento no reconocido: {arg}',
    'watch.invalidInterval': '[watch-github] El intervalo debe ser un número positivo de segundos.',

    'prompts.cancelled': 'cancelado',
    'prompts.selected': '{count} seleccionado(s)',
    'prompts.none': 'sin selección',

    'agents.help': `brain-corp agents:sync

Uso:
  node scripts/sync-agents.js [opciones]

Opciones:
  --root <dir>     Workspace destino (por defecto, el directorio actual).
  --agent <id>     Motor destino: {agents}.
  --overwrite      Sobrescribe assets existentes del workspace.
  --json           Imprime el resultado en JSON.
  --help           Muestra esta ayuda.

Sin --agent, usa defaultAgent de .brainrc.json (o "{default}").
Re-despliega prompts, skills, plantillas SDD, constitución central y comandos del motor sin abrir sesión.`,
    'agents.missingValue': 'Falta el valor para {option}',
    'agents.unknownOption': 'Opción desconocida: {option}',
    'agents.badConfig': 'No se pudo leer {file}: {error}',
    'agents.missingWorkspace': 'No existe el workspace: {root}',
    'agents.engine': '[sync-agents] Motor: {agent} · workspace: {root}',
    'agents.summary': '[sync-agents] {created} archivo(s) nuevos, {skipped} ya existentes.',

    'auth.helpTitle': 'brain-corp · Auditorías Enterprise',
    'auth.helpBody': 'Esta capacidad requiere una licencia Enterprise activa.',
    'auth.activate': 'Activa tu token de una de estas formas:',
    'auth.envOption': '1) Variable de entorno (recomendado en CI):',
    'auth.configOption': '2) Archivo local de configuración:',
    'auth.validation': 'La validación es local con firma Ed25519. Puedes indicar la clave pública con BRAIN_LICENSE_PUBLIC_KEY, BRAIN_LICENSE_PUBLIC_KEY_FILE o en ~/.brain/license-public.pem.',
    'auth.request': 'Solicita tu token al administrador de tu organización.'
  }
}

function format(template, params = {}) {
  return String(template).replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}|\{\s*([A-Za-z0-9_.-]+)\s*\}/g, (match, a, b) => {
    const key = a || b
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  })
}

function createTranslator(language = DEFAULT_LANGUAGE) {
  const lang = MESSAGES[language] ? language : DEFAULT_LANGUAGE
  const table = MESSAGES[lang]

  return function t(key, params = {}) {
    const template = table[key] !== undefined ? table[key] : MESSAGES[DEFAULT_LANGUAGE][key]
    return template === undefined ? key : format(template, params)
  }
}

function t(key, params = {}, language = resolveLanguage()) {
  return createTranslator(language)(key, params)
}

module.exports = {
  MESSAGES,
  createTranslator,
  format,
  resolveLanguage,
  t
}
