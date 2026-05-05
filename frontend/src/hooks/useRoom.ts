import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'

export interface Participant {
  clientID: number
  name: string
  color: string
}

export interface RoomState {
  participants: Participant[]
  language: string
  setLanguage: (lang: string) => void
}

export function useRoom(
  provider: WebsocketProvider | null,
  yMeta: Y.Map<string> | null,
): RoomState {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [language, setLanguageState] = useState<string>('text')

  useEffect(() => {
    if (!provider) return
    const awareness = provider.awareness

    const updateParticipants = () => {
      const list: Participant[] = []
      awareness.getStates().forEach((state, clientID) => {
        if (state.user) {
          list.push({
            clientID,
            name: state.user.name as string,
            color: state.user.color as string,
          })
        }
      })
      setParticipants(list)
    }

    awareness.on('change', updateParticipants)
    updateParticipants()

    return () => {
      awareness.off('change', updateParticipants)
    }
  }, [provider])

  useEffect(() => {
    if (!yMeta) return

    const updateLanguage = () => {
      const lang = yMeta.get('language') ?? 'text'
      setLanguageState(lang)
    }

    yMeta.observe(updateLanguage)
    updateLanguage()

    return () => {
      yMeta.unobserve(updateLanguage)
    }
  }, [yMeta])

  const setLanguage = (lang: string) => {
    yMeta?.set('language', lang)
  }

  return { participants, language, setLanguage }
}
