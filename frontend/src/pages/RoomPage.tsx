import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import NicknameModal from '../components/NicknameModal'
import RoomEditor from './RoomEditor'

type Phase = 'nickname' | 'checking' | 'ready' | 'not-found'

export default function RoomPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>(() => {
    return sessionStorage.getItem('sharecode.nickname') ? 'checking' : 'nickname'
  })

  const [nickname, setNickname] = useState<string>(
    () => sessionStorage.getItem('sharecode.nickname') ?? '',
  )

  const checkRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${id}`)
      if (res.ok) {
        setPhase('ready')
      } else {
        navigate('/', { state: { error: 'Комната не найдена или уже закрыта' } })
      }
    } catch {
      navigate('/', { state: { error: 'Ошибка соединения с сервером' } })
    }
  }, [id, navigate])

  useEffect(() => {
    if (phase === 'checking') {
      checkRoom()
    }
  }, [phase, checkRoom])

  const handleNicknameConfirm = (name: string) => {
    sessionStorage.setItem('sharecode.nickname', name)
    setNickname(name)
    setPhase('checking')
  }

  if (phase === 'nickname') {
    return <NicknameModal onConfirm={handleNicknameConfirm} />
  }

  if (phase === 'checking') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-10 w-10 text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-slate-400">Подключение к комнате...</span>
        </div>
      </div>
    )
  }

  return <RoomEditor roomId={id!} nickname={nickname} />
}
