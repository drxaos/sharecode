export const FORMATTABLE_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'css',
  'html',
  'json',
  'markdown',
  'yaml',
  'java',
  'kotlin',
  'sql',
])

export async function formatCode(langId: string, code: string): Promise<string | null> {
  if (!FORMATTABLE_LANGUAGES.has(langId)) return null

  const prettier = await import('prettier/standalone')

  switch (langId) {
    case 'javascript':
    case 'json': {
      const [babel, estree] = await Promise.all([
        import('prettier/plugins/babel'),
        import('prettier/plugins/estree'),
      ])
      return prettier.format(code, {
        parser: langId === 'json' ? 'json' : 'babel',
        plugins: [babel, estree],
        tabWidth: 2,
      })
    }
    case 'typescript': {
      const [ts, estree] = await Promise.all([
        import('prettier/plugins/typescript'),
        import('prettier/plugins/estree'),
      ])
      return prettier.format(code, {
        parser: 'typescript',
        plugins: [ts, estree],
        tabWidth: 2,
      })
    }
    case 'css': {
      const postcss = await import('prettier/plugins/postcss')
      return prettier.format(code, {
        parser: 'css',
        plugins: [postcss],
        tabWidth: 2,
      })
    }
    case 'html': {
      const html = await import('prettier/plugins/html')
      return prettier.format(code, {
        parser: 'html',
        plugins: [html],
        tabWidth: 2,
      })
    }
    case 'markdown': {
      const md = await import('prettier/plugins/markdown')
      return prettier.format(code, {
        parser: 'markdown',
        plugins: [md],
        tabWidth: 2,
      })
    }
    case 'yaml': {
      const yaml = await import('prettier/plugins/yaml')
      return prettier.format(code, {
        parser: 'yaml',
        plugins: [yaml],
        tabWidth: 2,
      })
    }
    case 'java': {
      const java = await import('prettier-plugin-java')
      return prettier.format(code, {
        parser: 'java',
        plugins: [java.default],
        tabWidth: 4,
      })
    }
    case 'kotlin':
      return formatKotlin(code)
    case 'sql': {
      const { format } = await import('sql-formatter')
      return format(code, { language: 'sql', tabWidth: 4 })
    }
    default:
      return null
  }
}

function formatKotlin(code: string): string {
  const INDENT = '    '
  const lines = code.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let depth = 0
  let inBlockComment = false
  let inTripleString = false

  for (const raw of lines) {
    const line = raw.trim()

    if (line === '') {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      continue
    }

    if (inBlockComment) {
      out.push(INDENT.repeat(depth) + line)
      if (line.includes('*/')) inBlockComment = false
      continue
    }

    const tripleCount = (line.match(/"""/g) ?? []).length
    if (tripleCount % 2 !== 0) inTripleString = !inTripleString

    if (inTripleString && tripleCount === 0) {
      out.push(raw)
      continue
    }

    if (/^}/.test(line)) depth = Math.max(0, depth - 1)

    out.push(INDENT.repeat(depth) + line)

    const stripped = line
      .replace(/\/\/.*$/, '')
      .replace(/"(?:[^"\\]|\\.)*"/g, '')
      .replace(/'(?:[^'\\]|\\.)*'/g, '')

    if (/\/\*/.test(stripped) && !/\*\//.test(stripped)) inBlockComment = true

    const opens = (stripped.match(/\{/g) ?? []).length
    const closes = (stripped.match(/}/g) ?? []).length
    depth = Math.max(0, depth + opens - closes)
  }

  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out.join('\n') + '\n'
}
