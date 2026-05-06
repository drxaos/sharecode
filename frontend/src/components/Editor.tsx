import { useEffect, useRef } from 'react'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState, Compartment, Transaction } from '@codemirror/state'
import {
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  indentUnit,
} from '@codemirror/language'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { yCollab } from 'y-codemirror.next'
import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'
import { getLang } from '../lib/languages'

interface EditorProps {
  yText: Y.Text
  provider: WebsocketProvider
  language: string
  fontSize: number
  theme: 'light' | 'dark'
  onSizeExceeded?: () => void
}

export default function Editor({ yText, provider, language, fontSize, theme, onSizeExceeded }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())
  const onSizeExceededRef = useRef(onSizeExceeded)
  onSizeExceededRef.current = onSizeExceeded

  // Initialize CodeMirror once
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        extensions: [
          lineNumbers(),
          indentOnInput(),
          indentUnit.of('  '),
          keymap.of([...defaultKeymap, indentWithTab]),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          langCompartment.current.of([]),
          themeCompartment.current.of([]),
          yCollab(yText, provider.awareness),
          EditorState.transactionFilter.of((tr) => {
            if (!tr.docChanged || !tr.annotation(Transaction.userEvent)) return tr
            if (tr.newDoc.length > 100_000) {
              onSizeExceededRef.current?.()
              return []
            }
            return tr
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: 'inherit' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-content': { caretColor: 'auto' },
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [yText, provider]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update language
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: langCompartment.current.reconfigure(getLang(language)),
    })
  }, [language])

  // Update theme
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(theme === 'dark' ? oneDark : []),
    })
  }, [theme])

  return (
    <div
      ref={containerRef}
      style={{ fontSize: `${fontSize}px` }}
      className="flex-1 h-full overflow-hidden"
    />
  )
}
