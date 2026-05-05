import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface LocationState {
  error?: string
  toast?: string
}

export default function LandingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as LocationState | null
    if (state?.error) {
      setError(state.error)
      window.history.replaceState({}, '')
    }
    if (state?.toast) {
      setToast(state.toast)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(t)
  }, [error])

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', { method: 'POST' })
      if (res.status === 429) {
        setError('Room limit reached. Please try again later.')
        return
      }
      if (!res.ok) {
        setError('Failed to create room. Please try again.')
        return
      }
      const { id } = await res.json()
      navigate(`/room/${id}`)
    } catch {
      setError('Server connection error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white px-4">
      {/* Toast notifications */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-yellow-900 px-5 py-3 rounded-xl shadow-lg font-medium text-sm z-50 animate-pulse">
          {toast}
        </div>
      )}

      <div className="flex flex-col items-center gap-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-10 h-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
              />
            </svg>
          </div>
          <h1 className="text-5xl font-thin tracking-tight">
            <span className="text-blue-600">Share</span>
            <span className="text-white">code</span>
          </h1>
          <p className="text-slate-400 text-lg">Real-time collaborative code editing</p>
        </div>

        {/* Action */}
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full max-w-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/30 disabled:opacity-60 disabled:cursor-not-allowed text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              'Create Room'
            )}
          </button>

          {error && (
            <div className="w-full max-w-xs bg-red-900/60 border border-red-500/50 text-red-300 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-slate-500 text-sm">
          Create a room, share the link — and edit code together
        </p>
      </div>
    </div>
  )
}
