import type { Participant } from '../hooks/useRoom'

interface ParticipantListProps {
  participants: Participant[]
  currentClientID: number
  onRenameClick: () => void
  isDark: boolean
}

export default function ParticipantList({
  participants,
  currentClientID,
  onRenameClick,
  isDark,
}: ParticipantListProps) {
  return (
    <div
      className={`hidden md:flex flex-col w-48 border-r overflow-y-auto flex-shrink-0 ${
        isDark
          ? 'bg-gray-800 border-gray-700 text-gray-100'
          : 'bg-gray-50 border-gray-200 text-gray-800'
      }`}
    >
      <div className="px-3 py-3 border-b border-inherit">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Участники ({participants.length})
        </span>
      </div>
      <ul className="py-2 space-y-0.5">
        {participants.map((p) => (
          <li
            key={p.clientID}
            className={`flex items-center gap-2 px-3 py-1.5 rounded mx-1 ${
              p.clientID === currentClientID
                ? isDark
                  ? 'bg-gray-700'
                  : 'bg-blue-50'
                : ''
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-sm truncate flex-1" title={p.name}>
              {p.name}
            </span>
            {p.clientID === currentClientID && (
              <button
                onClick={onRenameClick}
                title="Сменить имя"
                className={`text-xs flex-shrink-0 hover:scale-110 transition-transform ${
                  isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                ✏
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
