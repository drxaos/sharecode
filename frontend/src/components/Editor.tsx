import { useEffect, useRef } from 'react'
import { EditorView, lineNumbers } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import {
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language'
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
}

export default function Editor({ yText, provider, language, fontSize, theme }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const langCompartment = useRef(new Compartment())
  const themeCompartment = useRef(new Compartment())

  // Initialize CodeMirror once
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        extensions: [
          lineNumbers(),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          langCompartment.current.of([]),
          themeCompartment.current.of([]),
          yCollab(yText, provider.awareness),
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
