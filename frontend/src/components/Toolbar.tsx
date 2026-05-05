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
    if (!window.confirm('Close the room for all participants? This action is irreversible.')) return
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
      <span className="font-thin text-sm mr-2">
        <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>Share</span>
        <span className={isDark ? 'text-gray-100' : 'text-gray-800'}>code</span>
      </span>

      <div className={`w-px h-5 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />

      {/* Language selector */}
      <label className="flex items-center gap-1.5">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Language:</span>
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
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Font:</span>
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
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
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
        Close Room
      </button>
    </div>
  )
}
