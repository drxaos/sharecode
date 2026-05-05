import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useYjs } from '../hooks/useYjs'
import { useRoom } from '../hooks/useRoom'
import Editor from '../components/Editor'
import Toolbar from '../components/Toolbar'
import ParticipantList from '../components/ParticipantList'
import NicknameModal from '../components/NicknameModal'

interface RoomEditorProps {
  roomId: string
  nickname: string
}

export default function RoomEditor({ roomId, nickname }: RoomEditorProps) {
  const navigate = useNavigate()
  const yjsState = useYjs(roomId, nickname)
  const { participants, language, setLanguage } = useRoom(
    yjsState?.provider ?? null,
    yjsState?.yMeta ?? null,
  )

  const [fontSize, setFontSize] = useState(14)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [sizeWarning, setSizeWarning] = useState(false)

  // Handle WS close with code 1001 (room closed by someone)
  useEffect(() => {
    const provider = yjsState?.provider
    if (!provider) return
    const handleClose = (event: CloseEvent | null) => {
      if (event && event.code === 1001) {
        navigate('/', { state: { toast: 'Комната была закрыта' } })
      }
    }
    provider.on('connection-close', handleClose)
    return () => {
      provider.off('connection-close', handleClose)
    }
  }, [yjsState?.provider, navigate])

  // 100 KB limit warning
  useEffect(() => {
    const ydoc = yjsState?.ydoc
    const yText = yjsState?.yText
    if (!ydoc || !yText) return
    const handleUpdate = () => {
      const len = yText.toString().length
      if (len > 100_000 && !sizeWarning) {
        setSizeWarning(true)
        setTimeout(() => setSizeWarning(false), 5000)
      }
    }
    ydoc.on('update', handleUpdate)
    return () => {
      ydoc.off('update', handleUpdate)
    }
  }, [yjsState?.ydoc, yjsState?.yText, sizeWarning])

  const handleRename = (newName: string) => {
    sessionStorage.setItem('sharecode.nickname', newName)
    const provider = yjsState?.provider
    if (provider) {
      provider.awareness.setLocalStateField('user', {
        name: newName,
        color: provider.awareness.getLocalState()?.user?.color,
      })
    }
    setShowRenameModal(false)
  }

  if (!yjsState) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-slate-400">Инициализация редактора...</span>
        </div>
      </div>
    )
  }

  const { ydoc, provider, yText } = yjsState
  const isDark = theme === 'dark'

  return (
    <div
      className={`h-full flex flex-col ${
        isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'
      }`}
    >
      <Toolbar
        roomId={roomId}
        language={language}
        onLanguageChange={setLanguage}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        isDark={isDark}
      />

      {sizeWarning && (
        <div className="bg-yellow-500 text-yellow-900 text-sm text-center py-1.5 font-medium">
          Достигнут лимит объёма кода 100 КБ. Дальнейшее редактирование может быть недоступно.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ParticipantList
          participants={participants}
          currentClientID={ydoc.clientID}
          onRenameClick={() => setShowRenameModal(true)}
          isDark={isDark}
        />
        <Editor
          yText={yText}
          provider={provider}
          language={language}
          fontSize={fontSize}
          theme={theme}
        />
      </div>

      {showRenameModal && (
        <NicknameModal
          title="Сменить никнейм"
          initialValue={sessionStorage.getItem('sharecode.nickname') ?? ''}
          onConfirm={handleRename}
        />
      )}
    </div>
  )
}
