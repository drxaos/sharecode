import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getColor } from '../lib/colors'
import { debug, debugWarn } from '../lib/logger'

export interface YjsState {
  ydoc: Y.Doc
  provider: WebsocketProvider
  yText: Y.Text
  yMeta: Y.Map<string>
  isConnected: boolean
}

export function useYjs(roomId: string, nickname: string): YjsState | null {
  const [objects, setObjects] = useState<Omit<YjsState, 'isConnected'> | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const ydoc = new Y.Doc()
    const color = getColor(ydoc.clientID)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsBase = `${wsProtocol}://${window.location.host}/ws`
    debug(`[yjs:${roomId}] init — clientID=${ydoc.clientID}, nickname="${nickname}", color=${color}, url=${wsBase}/${roomId}`)

    const provider = new WebsocketProvider(wsBase, roomId, ydoc)
    provider.awareness.setLocalStateField('user', { name: nickname, color })
    const yText = ydoc.getText('content')
    const yMeta = ydoc.getMap<string>('meta')

    setObjects({ ydoc, provider, yText, yMeta })

    const handleStatus = ({ status }: { status: string }) => {
      debug(`[yjs:${roomId}] status → ${status}`)
      setIsConnected(status === 'connected')
    }
    provider.on('status', handleStatus)

    provider.on('sync', (synced: boolean) => {
      debug(`[yjs:${roomId}] sync → ${synced}`)
    })

    let updateCount = 0
    const handleUpdate = (_update: Uint8Array, origin: unknown) => {
      updateCount++
      const size = yText.toString().length
      const src = origin === provider ? 'remote' : 'local'
      debug(`[yjs:${roomId}] doc update #${updateCount} origin=${src} yText.length=${size}`)
      if (size > 100_000) {
        debugWarn(`[yjs:${roomId}] content exceeded 100 KB (${size} chars)`)
      }
    }
    ydoc.on('update', handleUpdate)

    const handleAwareness = () => {
      const participants = [...provider.awareness.getStates().entries()]
        .map(([id, state]) => `${id}:${(state as Record<string, Record<string, string>>)?.user?.name ?? '?'}`)
      debug(`[yjs:${roomId}] awareness — [${participants.join(', ')}]`)
    }
    provider.awareness.on('change', handleAwareness)

    return () => {
      debug(`[yjs:${roomId}] teardown`)
      provider.off('status', handleStatus)
      ydoc.off('update', handleUpdate)
      provider.awareness.off('change', handleAwareness)
      provider.destroy()
      ydoc.destroy()
      setObjects(null)
      setIsConnected(false)
    }
  }, [roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!objects) return null
  return { ...objects, isConnected }
}
