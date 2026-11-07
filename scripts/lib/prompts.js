const readline = require('node:readline')
const { t } = require('./i18n')

function isInteractiveTerminal() {
  return Boolean(
    process.stdin.isTTY &&
      process.stdout.isTTY &&
      typeof process.stdin.setRawMode === 'function'
  )
}

function truncate(value, maxLength = 110) {
  const text = String(value || '')
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

function promptSelection(
  rl,
  { message, choices, pageSize = 15, multiple = true, initialCursor = 0 }
) {
  if (!isInteractiveTerminal() || choices.length === 0) {
    return Promise.resolve(null)
  }

  return new Promise(resolve => {
    const selected = new Set()
    const wasRaw = Boolean(process.stdin.isRaw)
    let cursor = Math.min(
      Math.max(0, Number(initialCursor) || 0),
      choices.length - 1
    )
    let start = Math.max(0, cursor - pageSize + 1)
    let renderedLines = 0
    let finished = false

    const updateStart = () => {
      if (cursor < start) start = cursor
      if (cursor >= start + pageSize) start = cursor - pageSize + 1

      const maxStart = Math.max(0, choices.length - pageSize)
      if (start > maxStart) start = maxStart
    }

    const draw = () => {
      if (renderedLines > 0) {
        process.stdout.write(`\x1b[${renderedLines}A`)
      }

      process.stdout.write('\x1b[0J')

      const visible = choices.slice(start, start + pageSize)
      const lines = [
        `? ${message}`,
        multiple
          ? '  ↑/↓ mover · espacio marcar/desmarcar · Enter confirmar · a todos · q cancelar'
          : '  ↑/↓ mover · Enter seleccionar · q cancelar'
      ]

      visible.forEach((choice, offset) => {
        const index = start + offset
        const pointer = index === cursor ? '❯' : ' '
        const marker = multiple
          ? selected.has(index)
            ? '◉'
            : '◯'
          : index === cursor
            ? '◉'
            : '○'

        const maxLength = Math.max(30, (process.stdout.columns || 100) - 6)
        lines.push(`${pointer} ${marker} ${truncate(choice.name, maxLength)}`)
      })

      if (choices.length > pageSize) {
        lines.push(`  (${cursor + 1}/${choices.length})`)
      }

      process.stdout.write(`${lines.join('\n')}\n`)
      renderedLines = lines.length
    }

    const restoreTerminal = () => {
      process.stdin.removeListener('keypress', onKey)

      try {
        process.stdin.setRawMode(wasRaw)
      } catch {
        // La terminal ya pudo haberse restaurado.
      }

      if (!wasRaw) process.stdin.pause()

      process.stdout.write('\x1b[?25h')
    }

    const finish = value => {
      if (finished) return
      finished = true
      restoreTerminal()

      if (renderedLines > 0) {
        process.stdout.write(`\x1b[${renderedLines}A`)
        process.stdout.write('\x1b[0J')
      }

      const summary =
        value === null
          ? t('prompts.cancelled')
          : multiple
            ? t('prompts.selected', { count: value.length })
            : value && value.name
              ? value.name
              : t('prompts.none')

      console.log(`? ${message} ${summary}`)
      rl.resume()
      resolve(value)
    }

    const cancel = () => {
      if (finished) return
      finished = true
      restoreTerminal()

      if (renderedLines > 0) {
        process.stdout.write(`\x1b[${renderedLines}A`)
        process.stdout.write('\x1b[0J')
      }

      console.log(`? ${message} ${t('prompts.cancelled')}`)
      process.exit(130)
    }

    function onKey(input, key) {
      if (finished) return

      const isEnter =
        key.name === 'return' ||
        key.name === 'enter' ||
        key.sequence === '\r' ||
        key.sequence === '\n' ||
        input === '\r' ||
        input === '\n'
      const isSpace =
        key.name === 'space' || input === ' ' || key.sequence === ' '

      if (key.ctrl && key.name === 'c') return cancel()

      if (key.name === 'q' || key.name === 'escape') return finish(null)
      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + choices.length) % choices.length
        updateStart()
        return draw()
      }
      if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % choices.length
        updateStart()
        return draw()
      }
      if (key.name === 'pageup') {
        cursor = Math.max(0, cursor - pageSize)
        updateStart()
        return draw()
      }
      if (key.name === 'pagedown') {
        cursor = Math.min(choices.length - 1, cursor + pageSize)
        updateStart()
        return draw()
      }

      if (multiple && key.name === 'a') {
        if (selected.size === choices.length) selected.clear()
        else choices.forEach((_, index) => selected.add(index))
        return draw()
      }

      if (isSpace) {
        if (!multiple) return finish(choices[cursor])
        if (selected.has(cursor)) selected.delete(cursor)
        else selected.add(cursor)
        return draw()
      }

      if (isEnter) {
        if (!multiple) return finish(choices[cursor])

        // Enter confirma todos los elementos marcados con espacio, en orden
        // de la lista. El cursor por sí solo no se añade a la selección.
        const values = [...selected]
          .sort((a, b) => a - b)
          .map(index => choices[index])

        return finish(values)
      }
    }

    process.stdout.write('\x1b[?25l')
    rl.pause()
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('keypress', onKey)
    draw()
  })
}

async function confirm(rl, message, defaultValue = false) {
  if (isInteractiveTerminal()) {
    const selected = await promptSelection(rl, {
      message,
      choices: [
        { name: 'Sí', value: true },
        { name: 'No', value: false }
      ],
      pageSize: 2,
      multiple: false,
      initialCursor: defaultValue ? 0 : 1
    })

    if (selected === null) return defaultValue
    return Boolean(selected.value)
  }

  const suffix = defaultValue ? '(S/n)' : '(s/N)'
  const answer = (await rl.question(`${message} ${suffix}: `)).trim().toLowerCase()

  if (!answer) return defaultValue
  return ['s', 'si', 'sí', 'y', 'yes'].includes(answer)
}

module.exports = {
  confirm,
  isInteractiveTerminal,
  promptSelection,
  truncate
}
