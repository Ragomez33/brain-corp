#!/usr/bin/env node

const path = require('node:path')
const engine = require('./lib/brain/engine')
const { updateActive } = require('./lib/brain/state')

const COMMANDS = ['init-work', 'specify', 'plan', 'tasks', 'implement', 'analyze']

function fail(message) {
  console.error(`[sdd] ${message}`)
  process.exit(1)
}

function printHelp() {
  console.log(`brain SDD (.brain/)

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
  --help             Muestra esta ayuda.`)
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
      if (value === undefined || value.startsWith('--')) fail(`Falta el valor para ${current}`)
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
    else if (current.startsWith('-')) fail(`Opción desconocida: ${current}`)
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
    console.log(`[sdd] Feature ${ctx.ticketId} inicializada en ${path.relative(process.cwd(), ctx.featureDir)}`)
    console.log(`[sdd] Repositorio: ${ctx.repository.id} (${ctx.targetDomain})`)
    console.log(`[sdd] Plantillas: ${templates.created.length} nuevas, ${templates.skipped.length} existentes.`)
    if (ctx.contractRequired) {
      console.log(
        contract && contract.created
          ? '[sdd] contract.md generado (integración entre sidecars detectada).'
          : '[sdd] contract.md ya existía.'
      )
    }
    console.log(`[sdd] Siguiente: brain specify ${ctx.ticketId}`)
    return
  }

  if (command === 'specify' || command === 'plan' || command === 'tasks') {
    const { ctx, result: output } = result
    const file = path.relative(process.cwd(), output.path)
    console.log(output.created ? `[sdd] Generado ${file}` : `[sdd] Ya existe ${file} (usa --force para regenerar).`)
    const nextCommand = { specify: 'plan', plan: 'tasks', tasks: 'implement' }[command]
    if (nextCommand) console.log(`[sdd] Siguiente: brain ${nextCommand} ${ctx.ticketId}`)
    return
  }

  if (command === 'implement') {
    if (result.mode === 'batch') {
      if (result.pending.length === 0) {
        console.log('[sdd] No quedan tareas pendientes.')
        return
      }
      console.log(`[sdd] Batch: ${result.pending.length} tarea(s) pendientes.`)
      for (const item of result.pending) {
        console.log(`  - ${item.id}${item.parallel ? ' [P]' : ''} ${item.description}`)
      }
      return
    }

    if (result.completedTask) {
      console.log(`[sdd] Tarea ${result.completedTask} marcada como completada.`)
    }

    if (!result.next) {
      console.log('[sdd] No quedan tareas pendientes.')
      return
    }

    console.log(`[sdd] Siguiente tarea: ${result.next.id}${result.next.parallel ? ' [P]' : ''}`)
    console.log(`  ${result.next.description}`)
    console.log(`[sdd] Al terminar: brain implement ${result.ctx.ticketId} --complete ${result.next.id}`)
    return
  }

  if (command === 'analyze') {
    const { ctx, report } = result
    console.log(`[sdd] Análisis ${ctx.ticketId}: ${report.status.toUpperCase()}`)
    console.log(
      `[sdd] Requisitos: ${report.requirements} · tareas: ${report.tasks.done}/${report.tasks.total} completadas.`
    )
    for (const item of report.errors) console.log(`  ERROR: ${item}`)
    for (const item of report.warnings) console.log(`  WARN:  ${item}`)
    if (args.write) {
      console.log(`[sdd] Reporte: ${path.relative(process.cwd(), path.join(ctx.featureDir, 'analysis.md'))}`)
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
    fail(`Comando no reconocido: ${args.command}. Usa: ${COMMANDS.join(', ')}.`)
  }

  if (!args.ticketId) {
    fail(`Falta el ticket para "${args.command}". Uso: brain ${args.command} TICK-XXX.`)
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
