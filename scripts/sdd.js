#!/usr/bin/env node

const path = require('node:path')
const engine = require('./lib/brain/engine')
const { updateActive } = require('./lib/brain/state')
const { t } = require('./lib/i18n')

const COMMANDS = ['init-work', 'specify', 'plan', 'tasks', 'implement', 'analyze']

function fail(message) {
  console.error(`[sdd] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(t('sdd.help'))
}

function parseArgs(argv) {
  const args = {
    command: null,
    ticketId: null,
    repoId: null,
    force: false,
    mode: 'checkpoint',
    complete: null,
    write: true,
    json: false,
    help: false
  }

  const positional = []

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        fail(t('sdd.failMissingValue', { option: current }))
      }
      index += 1
      return value
    }

    if (current === '--repo') args.repoId = next()
    else if (current === '--force') args.force = true
    else if (current === '--mode') args.mode = next()
    else if (current === '--complete') args.complete = next()
    else if (current === '--no-write') args.write = false
    else if (current === '--json') args.json = true
    else if (current === '--help' || current === '-h') args.help = true
    else if (current.startsWith('-')) fail(t('sdd.failUnknownOption', { option: current }))
    else positional.push(current)
  }

  args.command = positional[0] || null
  args.ticketId = positional[1] || null

  return args
}

function printResult(command, result, args) {
  if (args.json) {
    if (command === 'analyze') {
      const { ctx, report } = result
      console.log(
        JSON.stringify(
          {
            ...report,
            featureDir: path.relative(process.cwd(), ctx.featureDir)
          },
          null,
          2
        )
      )
      return
    }

    const { ctx, ...rest } = result
    console.log(
      JSON.stringify(
        {
          ticketId: ctx.ticketId,
          repoId: ctx.repository.id,
          featureDir: path.relative(process.cwd(), ctx.featureDir),
          ...rest
        },
        null,
        2
      )
    )
    return
  }

  if (command === 'init-work') {
    const { ctx, templates, contract } = result
    console.log(
      t('sdd.featureInitialized', {
        ticket: ctx.ticketId,
        dir: path.relative(process.cwd(), ctx.featureDir)
      })
    )
    console.log(t('sdd.repository', { repo: ctx.repository.id, domain: ctx.targetDomain }))
    console.log(
      t('sdd.templates', {
        created: templates.created.length,
        skipped: templates.skipped.length
      })
    )
    if (ctx.contractRequired) {
      console.log(
        contract && contract.created ? t('sdd.contractCreated') : t('sdd.contractExists')
      )
    }
    console.log(t('sdd.nextInit', { ticket: ctx.ticketId }))
    return
  }

  if (command === 'specify' || command === 'plan' || command === 'tasks') {
    const { ctx, result: output } = result
    if (result.initialized) {
      console.log(
        t('sdd.autoInit', {
          ticket: ctx.ticketId,
          dir: path.relative(process.cwd(), ctx.featureDir)
        })
      )
    }
    const file = path.relative(process.cwd(), output.path)
    console.log(output.created ? t('sdd.generated', { file }) : t('sdd.exists', { file }))
    const nextCommand = { specify: 'plan', plan: 'tasks', tasks: 'implement' }[command]
    if (nextCommand) {
      console.log(t('sdd.next', { command: nextCommand, ticket: ctx.ticketId }))
    }
    return
  }

  if (command === 'implement') {
    if (result.mode === 'batch') {
      if (result.pending.length === 0) {
        console.log(t('sdd.noPending'))
        return
      }
      console.log(t('sdd.batchPending', { count: result.pending.length }))
      for (const item of result.pending) {
        console.log(`  - ${item.id}${item.parallel ? ' [P]' : ''} ${item.description}`)
      }
      return
    }

    if (result.completedTask) {
      console.log(t('sdd.taskCompleted', { task: result.completedTask }))
    }

    if (!result.next) {
      console.log(t('sdd.noPending'))
      return
    }

    console.log(
      t('sdd.nextTask', {
        id: `${result.next.id}${result.next.parallel ? ' [P]' : ''}`
      })
    )
    console.log(`  ${result.next.description}`)
    console.log(
      t('sdd.completeHint', { ticket: result.ctx.ticketId, id: result.next.id })
    )
    return
  }

  if (command === 'analyze') {
    const { ctx, report } = result
    console.log(t('sdd.analysisStatus', { ticket: ctx.ticketId, status: report.status.toUpperCase() }))
    console.log(
      t('sdd.analysisMetrics', {
        requirements: report.requirements,
        done: report.tasks.done,
        total: report.tasks.total
      })
    )
    for (const item of report.errors) console.log(`  ERROR: ${item}`)
    for (const item of report.warnings) console.log(`  WARN:  ${item}`)
    if (args.write) {
      console.log(
        t('sdd.analysisReport', {
          file: path.relative(process.cwd(), path.join(ctx.featureDir, 'analysis.md'))
        })
      )
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help || !args.command) {
    printHelp()
    if (!args.command && !args.help) process.exitCode = 1
    return
  }

  if (!COMMANDS.includes(args.command)) {
    fail(t('sdd.unknownCommand', { name: args.command, commands: COMMANDS.join(', ') }))
  }

  if (!args.ticketId) {
    fail(t('sdd.missingTicket', { command: args.command }))
  }

  let result

  if (args.command === 'init-work') {
    result = engine.initWork({ ticketId: args.ticketId, repoId: args.repoId, force: args.force })
  } else if (args.command === 'specify') {
    result = engine.specify({ ticketId: args.ticketId, repoId: args.repoId, force: args.force })
  } else if (args.command === 'plan') {
    result = engine.plan({ ticketId: args.ticketId, repoId: args.repoId, force: args.force })
  } else if (args.command === 'tasks') {
    result = engine.tasks({ ticketId: args.ticketId, repoId: args.repoId, force: args.force })
  } else if (args.command === 'implement') {
    result = engine.implement({
      ticketId: args.ticketId,
      repoId: args.repoId,
      mode: args.mode,
      taskId: args.complete
    })
    if (args.mode === 'batch') {
      updateActive(result.ctx.repoDir, { phase: 'implement', mode: 'batch' })
    }
  } else if (args.command === 'analyze') {
    result = engine.analyze({
      ticketId: args.ticketId,
      repoId: args.repoId,
      write: args.write
    })
  }

  printResult(args.command, result, args)
}

try {
  main()
} catch (error) {
  fail(error.message)
}
