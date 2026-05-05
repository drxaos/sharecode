# Backend — план разработки (Go)

## Контекст

Бэкенд сервиса Sharecode: совместный редактор кода для технических собеседований.
Один инстанс, до 10–100 одновременных комнат, данные в памяти, без БД.
Стек: Go 1.22+, `gorilla/websocket`, `google/uuid`, стандартная библиотека.

---

## Структура проекта

```
/
├── cmd/server/main.go
├── internal/
│   ├── api/handler.go
│   ├── room/
│   │   ├── room.go
│   │   └── store.go
│   └── ws/
│       ├── hub.go
│       └── client.go
├── frontend/dist/           # собирается фронтендом, монтируется при Docker build
├── Dockerfile
├── docker-compose.yml
├── go.mod
└── go.sum
```

---

## Шаги реализации

### Шаг 1. Инициализация модуля и зависимостей

**Файлы:** `go.mod`, `go.sum`

Действия:
- `go mod init github.com/xaos/sharecode`
- `go get github.com/gorilla/websocket`
- `go get github.com/google/uuid`

Зависимости:

| Пакет | Назначение |
|---|---|
| `github.com/gorilla/websocket` | WebSocket-сервер |
| `github.com/google/uuid` | UUID v4 для ID комнат |

---

### Шаг 2. Модель данных — `internal/room/room.go`

Определить структуры `Room` и `Client` (интерфейс/указатель — уточнить при связке с `ws`).

```go
type Room struct {
    ID         string
    Updates    [][]byte       // накопленные Yjs binary updates
    Clients    map[*ws.Client]bool
    CloseTimer *time.Timer    // nil пока есть клиенты
    mu         sync.Mutex
}
```

Методы:
- `AddClient(c *ws.Client)` — добавить клиента, отменить `CloseTimer`
- `RemoveClient(c *ws.Client, onEmpty func())` — удалить клиента; если пусто — запустить `onEmpty`
- `AppendUpdate(data []byte)` — добавить Yjs update в `Updates`
- `Close(closeCode int, msg string)` — отправить WS Close frame всем клиентам

**Ограничение циклической зависимости:** `room` не импортирует `ws`; `Client` передаётся как интерфейс или через обратный вызов.

---

### Шаг 3. Хранилище комнат — `internal/room/store.go`

```go
type Store struct {
    rooms map[string]*Room
    mu    sync.RWMutex
}
```

Методы:
- `NewStore() *Store`
- `Create() *Room` — создать комнату с UUID v4, добавить в map, вернуть
- `Get(id string) (*Room, bool)`
- `Delete(id string)` — удалить из map (предварительно `Room.Close` вызывается снаружи)
- `ActiveCount() int` — количество активных комнат (для rate limiting)

**Rate limiting:** при `Create()` проверять `len(rooms) >= 100`; если превышено — возвращать ошибку вместо создания.

---

### Шаг 4. WebSocket клиент — `internal/ws/client.go`

```go
type Client struct {
    conn   *websocket.Conn
    send   chan []byte
    roomID string
    hub    *Hub
}
```

Методы:
- `NewClient(conn, hub, roomID) *Client`
- `WritePump()` — горутина: читает из `send`, пишет в `conn`; при ошибке завершается
- `ReadPump()` — горутина: читает из `conn`, передаёт сообщения в `hub.HandleMessage`; при закрытии — вызывает `hub.Unregister`
- `Send(data []byte)` — неблокирующая запись в `send` (drop при переполнении)
- `CloseWithCode(code int, msg string)` — отправка WS Close frame и завершение

**Размер буфера `send`:** 256 сообщений.

---

### Шаг 5. Hub комнаты — `internal/ws/hub.go`

Один `Hub` на комнату. Управляет клиентами и маршрутизацией сообщений.

```go
type Hub struct {
    roomID   string
    store    *room.Store
    register   chan *Client
    unregister chan *Client
    broadcast  chan *envelope   // envelope: {sender, data}
}
```

Методы:
- `NewHub(roomID, store) *Hub`
- `Run()` — главный цикл (горутина): обрабатывает register/unregister/broadcast
- `Register(c *Client)` — добавить клиента, выполнить initial sync (см. шаг 7)
- `Unregister(c *Client)` — удалить клиента; если комната пуста — запустить таймер через `store`
- `HandleMessage(sender *Client, data []byte)` — разобрать тип сообщения и маршрутизировать

**Альтернатива:** вместо отдельного Hub на комнату — использовать `Room.mu` напрямую и методы комнаты. Выбрать подход при реализации (Hub рекомендован для чистоты).

---

### Шаг 6. Протокол y-websocket — разбор сообщений

Реализовать в `internal/ws/hub.go` (или отдельный `internal/ws/protocol.go`).

Все сообщения бинарные. Первый байт — тип:

| Байт | Тип | Действие сервера |
|------|-----|-----------------|
| `0`  | `messageSync` | Разобрать подтип (второй байт) |
| `1`  | `messageAwareness` | Переслать всем остальным клиентам без изменений |

Подтипы `messageSync`:

| Байт | Подтип | Направление | Действие |
|------|--------|-------------|---------|
| `0`  | `syncStep1` | Клиент→Сервер | Ответить `syncStep2` со всеми накопленными updates |
| `1`  | `syncStep2` | Сервер→Клиент | (сервер не получает; игнорировать если пришло) |
| `2`  | `update`    | Клиент→Сервер | Сохранить в `room.Updates`, разослать остальным |

Вспомогательные функции:
- `makeSyncStep2(updates [][]byte) []byte` — сформировать бинарный пакет `[0, 1, merged]`
- `makeUpdate(data []byte) []byte` — сформировать `[0, 2, data]`
- `mergeUpdates(updates [][]byte) []byte` — конкатенация (сервер не интерпретирует CRDT)

---

### Шаг 7. Initial sync при подключении клиента

При `Hub.Register(c)`:

1. Добавить клиента в `room.Clients`
2. Сформировать `syncStep2` из `room.Updates` (может быть пустым)
3. Отправить `c.Send(syncStep2Data)`
4. Запустить `c.WritePump()` и `c.ReadPump()` в горутинах

При получении `syncStep1` от клиента (шаг 6) — ответить ещё раз `syncStep2`. Дублирование безопасно: Yjs на клиенте идемпотентен.

---

### Шаг 8. REST API — `internal/api/handler.go`

Роутер: `http.ServeMux` (Go 1.22+, поддерживает `METHOD /path/{id}`).

#### POST /api/rooms

```
201 {"id": "<uuid>"}
429 {"error": "too many rooms"}
```

Логика:
1. `store.ActiveCount() >= 100` → 429
2. `room = store.Create()`
3. Запустить `hub = NewHub(room.ID, store); go hub.Run()`
4. Сохранить hub в глобальную map `hubMap[roomID]`
5. Вернуть 201 с JSON

#### GET /api/rooms/{id}

```
200 {}
404 {"error": "not found"}
```

#### DELETE /api/rooms/{id}

```
204
404 {"error": "not found"}
```

Логика:
1. Найти room и hub
2. Остановить `CloseTimer` если активен
3. `room.Close(1001, "room closed")` — WS Close всем клиентам
4. `store.Delete(id)`
5. Удалить hub из `hubMap`
6. Вернуть 204

#### GET /ws/{roomId}

Не REST, но регистрируется в том же `ServeMux`:

1. Найти room (404 если нет)
2. Upgrade соединения через `gorilla/websocket`
3. Создать `Client`, зарегистрировать в `hub`

**Хранение hubMap:** глобальная переменная в пакете `api` или вынести в отдельный `HubRegistry` в `internal/ws`. Защищена `sync.RWMutex`.

---

### Шаг 9. Жизненный цикл комнаты — таймер

В `Hub.Unregister`, когда `len(room.Clients) == 0`:

```go
room.CloseTimer = time.AfterFunc(5*time.Minute, func() {
    store.Delete(room.ID)
    // также удалить hub из hubMap
})
```

В `Hub.Register`, когда клиент подключается:

```go
if room.CloseTimer != nil {
    room.CloseTimer.Stop()
    room.CloseTimer = nil
}
```

Все операции с `CloseTimer` — под `room.mu`.

---

### Шаг 10. Точка входа — `cmd/server/main.go`

```go
func main() {
    store := room.NewStore()
    mux := http.NewServeMux()

    handler := api.NewHandler(store)
    handler.RegisterRoutes(mux)

    // SPA fallback: всё остальное → frontend/dist
    fs := http.FileServer(http.Dir("./frontend/dist"))
    mux.Handle("/", spaHandler(fs))

    log.Fatal(http.ListenAndServe(":8080", mux))
}
```

**SPA fallback:** кастомный `http.Handler`, который при 404 от `FileServer` отдаёт `index.html`.

---

### Шаг 11. Отдача статики и SPA fallback

Реализовать `spaHandler`:

```go
type spaHandler struct {
    fs   http.Handler
    root string
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    path := filepath.Join(h.root, r.URL.Path)
    if _, err := os.Stat(path); os.IsNotExist(err) {
        http.ServeFile(w, r, filepath.Join(h.root, "index.html"))
        return
    }
    h.fs.ServeHTTP(w, r)
}
```

Маршруты в порядке приоритета:
1. `/api/` → REST handlers
2. `/ws/` → WebSocket handler
3. Всё остальное → `spaHandler`

---

### Шаг 12. Dockerfile и docker-compose

Реализовать согласно спецификации (раздел 6):
- Multi-stage build: `node:20-alpine` (фронтенд) → `golang:1.22-alpine` (бэкенд) → `alpine:3.20` (runtime)
- `EXPOSE 8080`
- `docker-compose.yml` с `restart: unless-stopped`, порт `8080:8080`

---

## Порядок реализации (очередь задач)

| # | Задача | Файлы |
|---|--------|-------|
| 1 | Инициализация модуля, `go.mod` | `go.mod` |
| 2 | Модель данных `Room`, `Store` | `internal/room/room.go`, `store.go` |
| 3 | WebSocket `Client` (WritePump, ReadPump) | `internal/ws/client.go` |
| 4 | `Hub` (Register, Unregister, Run) | `internal/ws/hub.go` |
| 5 | Протокол y-websocket (разбор/формирование пакетов) | `internal/ws/hub.go` или `protocol.go` |
| 6 | REST API handlers + WebSocket upgrade | `internal/api/handler.go` |
| 7 | SPA fallback + точка входа | `cmd/server/main.go` |
| 8 | Dockerfile, docker-compose | `Dockerfile`, `docker-compose.yml` |

---

## Ключевые решения и граничные случаи

**Циклические зависимости:** `room` ↔ `ws` — решается передачей функции-колбэка или интерфейса вместо прямого импорта.

**Конкурентность:** Все обращения к `Room.Clients`, `Room.Updates`, `Room.CloseTimer` — под `room.mu`. Канал `send` клиента — единственная точка записи из нескольких горутин.

**Rate limiting:** считается `store.ActiveCount()` при создании; лимит 100 комнат на всю систему (не per-IP, т.к. один инстанс и внутренний инструмент — спецификация раздел 3.2).

**Пустые Updates при initial sync:** если `room.Updates` пуст, отправить `[0, 1, 0]` (syncStep2 с пустым update) — клиент ожидает этот пакет для завершения handshake.

**Закрытие hub при удалении комнаты:** `Hub.Run()` должен завершаться. Реализовать через дополнительный канал `done chan struct{}` в `Hub`.

**CORS:** открытый (внутренний инструмент) — добавить middleware с `Access-Control-Allow-Origin: *` на все `/api/` и `/ws/` маршруты.
