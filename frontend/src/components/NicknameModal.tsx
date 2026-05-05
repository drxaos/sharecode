import { useState, useEffect, useRef, type FormEvent } from 'react'

interface NicknameModalProps {
  onConfirm: (name: string) => void
  title?: string
  initialValue?: string
}

export default function NicknameModal({
  onConfirm,
  title = 'Войти в комнату',
  initialValue = '',
}: NicknameModalProps) {
  const [name, setName] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-8 w-96 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm mb-6">Введите никнейм для отображения другим участникам</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваш никнейм"
            maxLength={50}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 mb-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  )
}
