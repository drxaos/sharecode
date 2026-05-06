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
  // Plain text always first
  { id: 'text', label: 'Plain text' },
  // Alphabetical order (by label) for the rest
  { id: 'csharp', label: 'C#' },
  { id: 'cpp', label: 'C++' },
  { id: 'css', label: 'CSS' },
  { id: 'go', label: 'Go' },
  { id: 'html', label: 'HTML' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'json', label: 'JSON' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'php', label: 'PHP' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'sql', label: 'SQL' },
  { id: 'swift', label: 'Swift' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'xml', label: 'XML' },
  { id: 'yaml', label: 'YAML' },
];

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
