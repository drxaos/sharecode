# Спецификация сервиса Sharecode

## 1. Обзор

Sharecode — веб-сервис для совместного редактирования кода в реальном времени. Предназначен для технических собеседований. Один инстанс, до 10 одновременных комнат, развёртывание через Docker Compose.

---

## 2. Архитектура системы

```
Browser  <──HTTP/WS──>  Go HTTP Server
                              │
                        In-memory store
                        (rooms + Yjs doc state)
```

Go-сервер выполняет три функции:
1. Отдаёт статические файлы собранного React-приложения
2. REST API для управления комнатами
3. WebSocket-сервер (протокол y-websocket) для синхронизации редактора

Отдельной БД нет. Все данные — в памяти процесса.

---

## 3. Бэкенд (Go)

### 3.1 Структура проекта

```
/
├── cmd/server/main.go
├── internal/
│   ├── api/handler.go       # HTTP handlers (REST)
│   ├── room/
│   │   ├── room.go          # Room struct + lifecycle timer
│   │   └── store.go         # глобальный in-memory store
│   └── ws/
│       ├── hub.go           # per-room hub: clients, broadcast
│       └── client.go        # WebSocket client read/write loop
├── frontend/dist/           # собранные assets (копируются при Docker build)
├── Dockerfile
├── docker-compose.yml
├── go.mod
└── go.sum
```

### 3.2 REST API

| Метод  | Путь               | Описание                         | Успех        |
|--------|--------------------|----------------------------------|--------------|
| POST   | /api/rooms         | Создать комнату                  | 201 `{"id":"<uuid>"}` |
| GET    | /api/rooms/:id     | Проверить существование комнаты  | 200 / 404    |
| DELETE | /api/rooms/:id     | Немедленно закрыть комнату       | 204          |

**Rate limiting:** если общее число активных комнат достигло 100 для IP клиента, `POST /api/rooms` возвращает `429 Too Many Requests`.

Все ответы API в формате JSON. Для роутинга — стандартный `net/http` + `http.ServeMux` (Go 1.22+, поддерживает паттерн `METHOD /path/{id}`).

### 3.3 WebSocket endpoint

```
GET /ws/:roomId
```

Query-параметры: не используются (никнейм и цвет передаются через Yjs awareness после установки соединения).

Протокол: бинарные сообщения, совместимые с `y-websocket` (см. раздел 5).

### 3.4 Модель данных в памяти

```go
type Room struct {
    ID          string
    Updates     [][]byte          // накопленные Yjs binary updates (документ)
    Clients     map[*Client]bool
    CloseTimer  *time.Timer       // nil пока есть клиенты; 5 мин после ухода последнего
    mu          sync.Mutex
}

type Store struct {
    rooms map[string]*Room
    mu    sync.RWMutex
}
```

`Updates [][]byte` — список всех Yjs binary updates с момента создания комнаты. Сервер не интерпретирует бинарное содержимое — только хранит и ретранслирует. При подключении нового клиента сервер отправляет все накопленные updates.

### 3.5 Жизненный цикл комнаты

1. `POST /api/rooms` → создаётся `Room`, UUID генерируется через `github.com/google/uuid`
2. Клиенты подключаются по WS; пока хотя бы один клиент есть, `CloseTimer == nil`
3. Последний клиент отключился → запускается `time.AfterFunc(5 * time.Minute, store.Delete(id))`
4. Новый клиент подключился до истечения таймера → `timer.Stop()`, таймер сбрасывается
5. Таймер сработал → `Room` удаляется из `Store`
6. `DELETE /api/rooms/:id` → немедленное удаление: все WS-соединения закрываются с кодом `1001` и payload `"room closed"`, затем `Room` удаляется из `Store`

### 3.6 Обработка закрытия комнаты на сервере

При получении `DELETE /api/rooms/:id`:
1. Комната извлекается из store (404 если не найдена)
2. `CloseTimer` останавливается (если активен)
3. Всем подключённым `Client` отправляется WS Close frame (код 1001)
4. `Room` удаляется из store

### 3.7 Go-библиотеки

| Библиотека                       | Назначение                    |
|----------------------------------|-------------------------------|
| `github.com/gorilla/websocket`   | WebSocket сервер              |
| `github.com/google/uuid`         | Генерация ID комнат (UUID v4) |
| Стандартная библиотека           | HTTP, sync, time              |

---

## 4. Фронтенд (React)

### 4.1 Структура проекта

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   └── RoomPage.tsx
│   ├── components/
│   │   ├── Editor.tsx           # CodeMirror 6 + y-codemirror.next
│   │   ├── Toolbar.tsx          # язык, шрифт, тема, закрыть комнату
│   │   ├── ParticipantList.tsx  # список участников из awareness
│   │   └── NicknameModal.tsx    # модальное окно при входе в комнату
│   ├── hooks/
│   │   ├── useYjs.ts            # Yjs doc + WebSocketProvider + awareness
│   │   └── useRoom.ts           # реактивное состояние: язык, участники
│   ├── lib/
│   │   └── colors.ts            # палитра 12 цветов, назначение по clientID
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

### 4.2 Маршрутизация

| Путь        | Компонент    | Описание                              |
|-------------|--------------|---------------------------------------|
| `/`         | LandingPage  | Логотип + кнопка «Создать комнату»    |
| `/room/:id` | RoomPage     | Редактор кода + панель участников     |

Все остальные пути — редирект на `/`. Библиотека: `react-router-dom` v6 (HashRouter или BrowserRouter с SPA fallback на Go-сервере).

### 4.3 Landing Page

- Логотип сервиса (SVG или текст)
- Кнопка «Создать комнату»: `POST /api/rooms` → `navigate('/room/:id')`
- Центрированный макет, Tailwind

### 4.4 Room Page — вход

При первом открытии `/room/:id`:
1. Проверяется наличие никнейма в `sessionStorage` (ключ `sharecode.nickname`)
2. Если не задан — отображается `NicknameModal` (блокирует страницу)
3. После ввода никнейма (непустого) — сохранить в `sessionStorage`, закрыть модальное окно
4. Проверить существование комнаты: `GET /api/rooms/:id`; если 404 — перенаправить на `/` с сообщением «Комната не найдена»

### 4.5 Room Page — layout

```
┌────────────────────────────────────────────────────────────────┐
│ Toolbar: [Язык ▼]  [Шрифт ▼]  [☀/🌙]  [Закрыть комнату]     │
├───────────────────┬────────────────────────────────────────────┤
│  Participant List │  CodeMirror Editor                         │
│  ────────────     │  (line numbers, remote cursors,            │
│  ● Alice          │   remote selections, auto-indent)          │
│  ● Bob            │                                            │
└───────────────────┴────────────────────────────────────────────┘
```

Боковая панель участников — фиксированная ширина слева. Редактор — flex-grow. Мобильный вид: боковая панель скрыта (или свёрнута).

### 4.6 Редактор

Библиотека: **CodeMirror 6**

Конфигурация:
- `lineNumbers()` — номера строк
- `indentOnInput()` — автоотступ при переходе на новую строку
- `syntaxHighlighting(defaultHighlightStyle)` — подсветка синтаксиса
- Язык — динамически через `StateEffect` при изменении `Y.Map("meta")["language"]`
- Размер шрифта — CSS-переменная на wrapper `div`, управляется локальным state
- Тема — `EditorView.theme({})` или готовая тема (светлая по умолчанию; переключение через `compartment.reconfigure`)
- Yjs binding — `yCollab(yText, awareness)` из `y-codemirror.next`

Ограничение 100 КБ: слушатель на `yDoc.on('update', ...)` — если `yText.toString().length > 100_000`, update отклоняется (с уведомлением пользователя).

### 4.7 Синхронизация языка подсветки

Язык хранится в `Y.Map` как shared state:

```ts
const meta = yDoc.getMap<string>('meta')
// при смене языка:
meta.set('language', 'javascript')
// подписка:
meta.observe(() => {
  const lang = meta.get('language') ?? 'text'
  reconfigureEditorLanguage(lang)
})
```

Это гарантирует, что смена языка одним пользователем немедленно применяется у всех остальных.

### 4.8 Цвета пользователей

Предзаданная палитра из 12 контрастных цветов. При подключении клиент получает цвет:

```ts
const color = COLORS[ydoc.clientID % COLORS.length]
```

Цвет и никнейм передаются через awareness:

```ts
awareness.setLocalStateField('user', { name: nickname, color })
```

### 4.9 Панель участников

Реактивно отображает список пользователей из awareness. Для каждого: цветной кружок + никнейм. Обновляется при каждом `awareness.on('change', ...)`.

### 4.10 Toolbar

| Элемент | Тип | Синхронизация |
|---------|-----|---------------|
| Язык подсветки | `<select>` со всеми языками CodeMirror | Все участники (через `Y.Map`) |
| Размер шрифта | `<select>`: 12/14/16/18/20px. Default: 14px | Только текущее окно |
| Тема (светлая/тёмная) | toggle-кнопка | Только текущее окно |
| Закрыть комнату | кнопка с подтверждением | — |

Языки в selector: все языковые пакеты CodeMirror (javascript, typescript, python, go, java, cpp, csharp, rust, html, css, sql, json, yaml, markdown, xml, php, swift, kotlin, plain text и др.).

### 4.11 Закрытие комнаты (кнопка)

1. Показывается диалог подтверждения
2. При подтверждении: `DELETE /api/rooms/:id`
3. Фронтенд не ждёт ответа — сразу переходит на `/`
4. Остальные клиенты получают WS Close frame (1001) от сервера → перехватывают событие `close` → `navigate('/')` с toast «Комната была закрыта»

### 4.12 Переподключение

`y-websocket` реализует автоматическое переподключение с экспоненциальной задержкой. При переподключении провайдер выполняет стандартный sync-handshake и получает актуальное состояние документа — дополнительных действий не требуется.

### 4.13 Смена никнейма

Кнопка «Сменить имя» в панели участников (рядом с именем текущего пользователя) или в Toolbar открывает `NicknameModal`. После ввода нового никнейма: обновить `sessionStorage` и `awareness.setLocalStateField('user', ...)`.

### 4.14 Фронтенд-библиотеки

| Библиотека              | Версия  | Назначение                              |
|-------------------------|---------|-----------------------------------------|
| react                   | 18      | UI                                      |
| react-router-dom        | 6       | Маршрутизация                           |
| yjs                     | latest  | CRDT документ                           |
| y-websocket             | latest  | WebSocket провайдер для Yjs             |
| y-codemirror.next       | latest  | Yjs binding для CodeMirror 6            |
| @codemirror/view        | 6       | Редактор                                |
| @codemirror/state       | 6       | State management                        |
| @codemirror/language    | 6       | Языковая поддержка                      |
| @codemirror/lang-*      | 6       | Языковые пакеты                         |
| @codemirror/commands    | 6       | Команды (автоотступ и др.)              |
| tailwindcss             | 3       | CSS-фреймворк                           |
| vite                    | 5       | Сборщик                                 |

---

## 5. Протокол WebSocket

### 5.1 y-websocket бинарный протокол

Все сообщения — бинарные (`BinaryMessage`). Первый байт (varint) — тип сообщения:

| Тип | Значение | Описание |
|-----|----------|----------|
| `messageSync` | 0 | Синхронизация Yjs документа |
| `messageAwareness` | 1 | Курсоры, выделения, никнеймы |

Внутри `messageSync` первый varint — подтип:

| Подтип | Значение | Направление | Содержимое |
|--------|----------|-------------|------------|
| `syncStep1` | 0 | Клиент→Сервер | State vector клиента |
| `syncStep2` | 1 | Сервер→Клиент | Binary update (то, чего нет у клиента) |
| `update`    | 2 | Клиент→Сервер / Сервер→Клиент | Инкрементальный update |

### 5.2 Логика сервера при подключении клиента

1. Клиент подключается по WS
2. Сервер немедленно отправляет `[0, 1, merged_updates]` (syncStep2 с накопленным состоянием документа)
3. Клиент присылает `[0, 0, stateVector]` (syncStep1 — чего не хватает)
4. Сервер отвечает `[0, 1, missing_updates]` — в простой реализации: те же `merged_updates` (клиент проигнорирует дубли)
5. Далее: любой `update` от клиента добавляется в `room.Updates[]` и рассылается всем остальным клиентам комнаты как `[0, 2, update]`

### 5.3 Awareness

Awareness-сообщения (`[1, ...]`) сервер пересылает всем остальным клиентам комнаты без изменений. Состояние awareness не персистируется.

### 5.4 Реализация varint на Go

Использовать простой encoding — первые байты сообщения: `uint8(type)`, затем данные. Для совместимости с lib0 (JS) — encoding достаточен однобайтовый uint для типов 0-127.

---

## 6. Развёртывание

### 6.1 Dockerfile (multi-stage)

```dockerfile
# Stage 1: сборка фронтенда
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY ../frontend ./
RUN npm run build

# Stage 2: сборка бэкенда
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY ../go.mod go.sum ./
RUN go mod download
COPY .. .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o sharecode ./cmd/server

# Stage 3: runtime
FROM alpine:3.20
WORKDIR /app
COPY --from=backend-builder /app/sharecode .
COPY --from=backend-builder /app/frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["./sharecode"]
```

### 6.2 docker-compose.yml

```yaml
version: '3.9'
services:
  sharecode:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
```

### 6.3 Отдача статики и SPA fallback

Go-сервер:
- `GET /api/*` → REST handlers
- `GET /ws/*` → WebSocket handler
- Всё остальное → `http.FileServer` из `./frontend/dist` с SPA fallback: если файл не найден, отдаётся `index.html`

---

## 7. Нефункциональные требования и ограничения

| Параметр | Значение |
|---|---|
| Персистентность данных | Нет; перезапуск сервера уничтожает все комнаты |
| Масштабирование | Один инстанс |
| Максимум активных комнат | 100 |
| Максимум участников в комнате | Без ограничений |
| Максимальный объём кода | 100 КБ |
| Время жизни комнаты после ухода последнего участника | 5 минут |
| Пароль на комнату | Нет; закрытость через непредсказуемый UUID |
| CORS | Открытый (internal tool) |
| Мобильная поддержка | Базовая адаптивность (чтение); редактирование неудобно |
| Accessibility | Нет специальных требований |
| Аутентификация | Нет; никнейм вводится при входе |
| Чат | Нет |
| Выполнение кода | Нет |

---

## 8. Сценарии использования (Use Cases)

### UC-1: Создание комнаты

1. Пользователь открывает `/`
2. Нажимает «Создать комнату»
3. Браузер делает `POST /api/rooms`
4. Редирект на `/room/<uuid>`
5. Показывается `NicknameModal`
6. Пользователь вводит никнейм, нажимает «Войти»
7. Устанавливается WS, отображается редактор

### UC-2: Подключение к существующей комнате

1. Пользователь получает URL `/room/<uuid>`
2. Открывает URL; показывается `NicknameModal`
3. Вводит никнейм → WS установлен
4. Клиент получает актуальное состояние документа через sync
5. В панели участников появляется новый участник у всех

### UC-3: Совместное редактирование

1. Пользователь A вводит текст → Yjs генерирует update → отправляется на сервер
2. Сервер добавляет update в `room.Updates`, рассылает всем остальным клиентам
3. Клиент B получает update, Yjs применяет к локальному документу, CodeMirror перерисовывает
4. Курсор A виден у пользователя B (через awareness)

### UC-4: Смена языка подсветки

1. Пользователь A выбирает язык в Toolbar
2. Значение записывается в `Y.Map("meta")["language"]`
3. Yjs синхронизирует изменение всем клиентам
4. У всех CodeMirror перенастраивает языковой compartment

### UC-5: Закрытие комнаты

1. Любой участник нажимает «Закрыть комнату»
2. Подтверждение диалогом
3. `DELETE /api/rooms/:id`
4. Сервер закрывает все WS (код 1001)
5. Все клиенты переходят на `/`

### UC-6: Переподключение при разрыве WS

1. WS-соединение клиента разорвано
2. `y-websocket` автоматически пробует переподключиться
3. При успехе — sync-handshake, клиент получает пропущенные updates
4. Редактирование продолжается без потери данных
