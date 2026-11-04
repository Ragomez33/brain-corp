function quoteArg(value) {
  const arg = String(value)

  if (process.platform === 'win32') {
    if (arg === '') return '""'
    if (!/[\s"&|<>^()%!]/.test(arg)) return arg

    // Reglas de CommandLineToArgvW: duplica las barras previas a una comilla
    // y las barras finales del argumento.
    const escaped = arg
      .replace(/(\\*)"/g, '$1$1\\"')
      .replace(/(\\+)$/, '$1$1')

    return `"${escaped}"`
  }

  if (arg === '') return "''"
  if (!/[\s'"$`\\!*?[\]{}()<>|&;]/.test(arg)) return arg

  return `'${arg.replace(/'/g, `'\\''`)}'`
}

function buildCommand(command, args = []) {
  return [quoteArg(command), ...args.map(quoteArg)].join(' ')
}

function buildNodeCommand(scriptPath, args = []) {
  return buildCommand(process.execPath, [scriptPath, ...args])
}

module.exports = {
  buildCommand,
  buildNodeCommand,
  quoteArg
}
