import { useNavigate } from 'react-router-dom'
import { LANGUAGES } from '../lib/languages'

interface ToolbarProps {
  roomId: string
  language: string
  onLanguageChange: (lang: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  isDark: boolean
}

const FONT_SIZES = [12, 14, 16, 18, 20]

export default function Toolbar({
  roomId,
  language,
  onLanguageChange,
  fontSize,
  onFontSizeChange,
  theme,
  onThemeToggle,
  isDark,
}: ToolbarProps) {
  const navigate = useNavigate()

  const handleCloseRoom = async () => {
    if (!window.confirm('Закрыть комнату для всех участников? Это действие необратимо.')) return
    fetch(`/api/rooms/${roomId}`, { method: 'DELETE' }).catch(() => {})
    navigate('/')
  }

  const selectClass = `text-sm rounded px-2 py-1 border focus:outline-none focus:ring-1 focus:ring-blue-400 transition ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-gray-100'
      : 'bg-white border-gray-300 text-gray-800'
  }`

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 border-b flex-shrink-0 ${
        isDark
          ? 'bg-gray-800 border-gray-700 text-gray-100'
          : 'bg-gray-100 border-gray-200 text-gray-800'
      }`}
    >
      {/* Logo */}
      <span className={`font-bold text-sm mr-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
        Sharecode
      </span>

      <div className={`w-px h-5 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />

      {/* Language selector */}
      <label className="flex items-center gap-1.5">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Язык:</span>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className={selectClass}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </select>
      </label>

      {/* Font size selector */}
      <label className="flex items-center gap-1.5">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Шрифт:</span>
        <select
          value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className={selectClass}
        >
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </label>

      {/* Theme toggle */}
      <button
        onClick={onThemeToggle}
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        className={`p-1.5 rounded hover:bg-opacity-20 transition ${
          isDark ? 'hover:bg-white text-gray-300' : 'hover:bg-black text-gray-600'
        }`}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Close room */}
      <button
        onClick={handleCloseRoom}
        className="text-sm px-3 py-1.5 rounded border border-red-400 text-red-500 hover:bg-red-500 hover:text-white transition"
      >
        Закрыть комнату
      </button>
    </div>
  )
}
