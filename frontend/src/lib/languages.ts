import { StreamLanguage } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { go } from '@codemirror/lang-go'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { php } from '@codemirror/lang-php'
import { csharp } from '@codemirror/legacy-modes/mode/clike'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { kotlin } from '@codemirror/legacy-modes/mode/clike'
import type { Extension } from '@codemirror/state'

export interface Language {
  id: string
  label: string
}

export const LANGUAGES: Language[] = [
  { id: 'text', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'rust', label: 'Rust' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'sql', label: 'SQL' },
  { id: 'yaml', label: 'YAML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'xml', label: 'XML' },
  { id: 'php', label: 'PHP' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
]

export function getLang(id: string): Extension {
  switch (id) {
    case 'javascript':
      return javascript({ jsx: true })
    case 'typescript':
      return javascript({ typescript: true, jsx: true })
    case 'python':
      return python()
    case 'go':
      return go()
    case 'java':
      return java()
    case 'cpp':
      return cpp()
    case 'csharp':
      return StreamLanguage.define(csharp)
    case 'rust':
      return rust()
    case 'html':
      return html()
    case 'css':
      return css()
    case 'json':
      return json()
    case 'sql':
      return sql()
    case 'yaml':
      return yaml()
    case 'markdown':
      return markdown()
    case 'xml':
      return xml()
    case 'php':
      return php()
    case 'swift':
      return StreamLanguage.define(swift)
    case 'kotlin':
      return StreamLanguage.define(kotlin)
    default:
      return []
  }
}
