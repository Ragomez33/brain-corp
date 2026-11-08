function quoteArg(value) {
  const arg = String(value)

  if (process.platform === 'win32') {
    if (arg === '') return '""'
    if (!/[\s"&|<>^()%!]/.test(arg)) return arg

    // CommandLineToArgvW rules: double backslashes before a quote
    // and trailing backslashes at the end of the argument.
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
