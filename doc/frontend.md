# План разработки фронтенда — Sharecode

## Стек технологий

| Инструмент | Версия | Роль |
|---|---|---|
| Vite | 5 | Сборщик |
| React | 18 | UI |
| TypeScript | 5 | Типизация |
| react-router-dom | 6 | Маршрутизация |
| Tailwind CSS | 3 | Стили |
| CodeMirror | 6 | Редактор кода |
| Yjs | latest | CRDT-документ |
| y-websocket | latest | WebSocket-провайдер |
| y-codemirror.next | latest | Yjs ↔ CodeMirror binding |

---

## Структура проекта

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   └── RoomPage.tsx
│   ├── components/
│   │   ├── Editor.tsx
│   │   ├── Toolbar.tsx
│   │   ├── ParticipantList.tsx
│   │   └── NicknameModal.tsx
│   ├── hooks/
│   │   ├── useYjs.ts
│   │   └── useRoom.ts
│   ├── lib/
│   │   └── colors.ts
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Этапы разработки

### Этап 1 — Инициализация проекта

1. Создать проект: `npm create vite@latest frontend -- --template react-ts`
2. Установить зависимости:
   ```bash
   npm install react-router-dom
   npm install yjs y-websocket y-codemirror.next
   npm install @codemirror/view @codemirror/state @codemirror/language @codemirror/commands
   npm install @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-go
   npm install @codemirror/lang-java @codemirror/lang-cpp @codemirror/lang-rust
   npm install @codemirror/lang-html @codemirror/lang-css @codemirror/lang-json
   npm install @codemirror/lang-sql @codemirror/lang-yaml @codemirror/lang-markdown
   npm install @codemirror/lang-xml @codemirror/lang-php
   npm install @codemirror/theme-one-dark
   npm install tailwindcss @tailwindcss/vite
   ```
3. Настроить Tailwind: `tailwind.config.ts` + директива `@tailwind` в `index.css`
4. Настроить `vite.config.ts`: proxy `/api` и `/ws` на `http://localhost:8080` для локальной разработки

### Этап 2 — Маршрутизация и скелет приложения

**`src/App.tsx`**
- `BrowserRouter` с двумя маршрутами:
  - `/` → `LandingPage`
  - `/room/:id` → `RoomPage`
  - `*` → редирект на `/`

**`src/main.tsx`**
- Монтирование `<App />` в DOM

### Этап 3 — Landing Page

**`src/pages/LandingPage.tsx`**
- Центрированный макет (flexbox, full-height)
- Логотип: текст «Sharecode» крупным шрифтом
- Кнопка «Создать комнату»:
  - `POST /api/rooms` → получить `{ id }`
  - `navigate('/room/' + id)`
  - Состояние loading на кнопке во время запроса
  - Обработка ошибок (429 — слишком много комнат, 5xx)

### Этап 4 — Вспомогательный модуль цветов

**`src/lib/colors.ts`**
- Массив `COLORS` из 12 контрастных hex-цветов
- Функция `getColor(clientID: number): string` — `COLORS[clientID % COLORS.length]`

### Этап 5 — Хук useYjs

**`src/hooks/useYjs.ts`**

```ts
// Возвращает:
// { ydoc, provider, awareness, yText, yMeta, isConnected }
```

- Создать `Y.Doc`
- Определить цвет: `getColor(ydoc.clientID)`
- Получить никнейм из `sessionStorage` (`sharecode.nickname`)
- Создать `WebsocketProvider(wsUrl, roomId, ydoc)`
- Установить `awareness.setLocalStateField('user', { name, color })`
- Получить `yText = ydoc.getText('content')`
- Получить `yMeta = ydoc.getMap<string>('meta')`
- При размонтировании: `provider.destroy()`
- Слушать `ydoc.on('update')`: если `yText.toString().length > 100_000` — откатить (уведомить пользователя)

### Этап 6 — Хук useRoom

**`src/hooks/useRoom.ts`**

```ts
// Принимает: { awareness, yMeta }
// Возвращает: { participants, language, setLanguage }
```

- `participants` — реактивный список из awareness:
  ```ts
  awareness.on('change', () => {
    const states = Array.from(awareness.getStates().values())
    setParticipants(states.map(s => s.user).filter(Boolean))
  })
  ```
- `language` — из `yMeta.observe()`: `yMeta.get('language') ?? 'text'`
- `setLanguage(lang)` — `yMeta.set('language', lang)`

### Этап 7 — Компонент Editor

**`src/components/Editor.tsx`**

Props: `{ yText, awareness, language, fontSize }`

Инициализация CodeMirror (один раз через `useEffect`):
```ts
const languageCompartment = new Compartment()
const themeCompartment = new Compartment()

const view = new EditorView({
  state: EditorState.create({
    extensions: [
      lineNumbers(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle),
      languageCompartment.of(/* начальный язык */),
      themeCompartment.of(EditorView.theme({})),
      yCollab(yText, awareness),
    ]
  }),
  parent: containerRef.current
})
```

- При изменении `language` prop: `view.dispatch({ effects: languageCompartment.reconfigure(getLang(language)) })`
- При изменении `fontSize`: CSS-переменная на wrapper div
- При изменении `theme`: `themeCompartment.reconfigure(...)`
- Вспомогательная функция `getLang(name: string)` — маппинг имени языка на языковой пакет CodeMirror

**Список поддерживаемых языков** (`src/lib/languages.ts`):
```ts
export const LANGUAGES = [
  { id: 'text',       label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python',     label: 'Python' },
  { id: 'go',         label: 'Go' },
  { id: 'java',       label: 'Java' },
  { id: 'cpp',        label: 'C++' },
  { id: 'csharp',     label: 'C#' },
  { id: 'rust',       label: 'Rust' },
  { id: 'html',       label: 'HTML' },
  { id: 'css',        label: 'CSS' },
  { id: 'json',       label: 'JSON' },
  { id: 'sql',        label: 'SQL' },
  { id: 'yaml',       label: 'YAML' },
  { id: 'markdown',   label: 'Markdown' },
  { id: 'xml',        label: 'XML' },
  { id: 'php',        label: 'PHP' },
  { id: 'swift',      label: 'Swift' },
  { id: 'kotlin',     label: 'Kotlin' },
]
```

### Этап 8 — Компонент Toolbar

**`src/components/Toolbar.tsx`**

Props: `{ roomId, language, onLanguageChange, fontSize, onFontSizeChange, theme, onThemeToggle }`

Элементы:
- `<select>` языков (все из `LANGUAGES`) — изменение синхронизируется через `yMeta` для всех участников
- `<select>` размера шрифта: `[12, 14, 16, 18, 20]px`, default 14px — только локально
- Кнопка тема ☀/🌙 — только локально
- Кнопка «Закрыть комнату»:
  1. `window.confirm('Закрыть комнату для всех участников?')`
  2. `DELETE /api/rooms/:id`
  3. `navigate('/')`

### Этап 9 — Компонент ParticipantList

**`src/components/ParticipantList.tsx`**

Props: `{ participants, currentClientID, onRenameClick }`

- Список участников: цветной кружок + никнейм
- Рядом с именем текущего пользователя — кнопка «✏» для смены никнейма
- Мобильный вид: панель скрыта (`hidden md:flex`)

### Этап 10 — Компонент NicknameModal

**`src/components/NicknameModal.tsx`**

Props: `{ onConfirm: (name: string) => void }`

- Модальное окно поверх страницы (backdrop blur)
- Инпут для никнейма (обязательное, не пустое)
- Кнопка «Войти»
- Enter сабмитит форму
- Используется при входе в комнату и при смене никнейма

### Этап 11 — Room Page

**`src/pages/RoomPage.tsx`**

Логика при монтировании:
1. Проверить `sessionStorage.getItem('sharecode.nickname')`:
   - Если не задан — показать `NicknameModal`, заблокировать страницу
2. После получения никнейма: `GET /api/rooms/:id`:
   - 404 → `navigate('/', { state: { error: 'Комната не найдена' } })`
   - 200 → инициализировать `useYjs`, рендерить страницу
3. Слушать событие закрытия WS:
   ```ts
   provider.on('connection-close', (event) => {
     if (event.code === 1001) {
       navigate('/', { state: { toast: 'Комната была закрыта' } })
     }
   })
   ```

Состояние:
- `nickname` — из sessionStorage
- `fontSize` — локальный state (default 14)
- `theme` — локальный state ('light' | 'dark')
- `showNicknameModal` — для смены никнейма

Layout (flex column, full-height):
```
<Toolbar />
<div className="flex flex-1 overflow-hidden">
  <ParticipantList />
  <Editor />
</div>
```

### Этап 12 — Toast-уведомления

На Landing Page: показывать сообщение из `location.state.error` или `location.state.toast` (если переброшен с Room Page).

Реализация: простой `useState` с авто-скрытием через `setTimeout` (3 сек). Сторонняя библиотека не нужна.

---

## Порядок реализации (рекомендуемый)

| № | Задача | Зависимости |
|---|---|---|
| 1 | Инициализация проекта, Vite, Tailwind | — |
| 2 | App.tsx, маршрутизация | 1 |
| 3 | LandingPage (статика + POST /api/rooms) | 2 |
| 4 | colors.ts, languages.ts | — |
| 5 | NicknameModal | — |
| 6 | useYjs | 4, 5 |
| 7 | useRoom | 6 |
| 8 | Editor (CodeMirror без коллаборации) | 4 |
| 9 | Editor + yCollab интеграция | 6, 8 |
| 10 | Toolbar | 4, 7 |
| 11 | ParticipantList | 7 |
| 12 | RoomPage (сборка всех компонентов) | 5–11 |
| 13 | Обработка WS close 1001 | 12 |
| 14 | Toast на LandingPage | 3, 13 |
| 15 | Адаптивность (скрыть sidebar на mobile) | 11 |
| 16 | Ограничение 100 КБ | 9 |

---

## Ключевые технические решения

### WebSocket URL
```ts
const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/${roomId}`
```

### Смена темы CodeMirror
Светлая тема — `basicSetup` по умолчанию. Тёмная — `@codemirror/theme-one-dark`. Переключение через `Compartment.reconfigure`.

### Инициализация EditorView
EditorView создаётся один раз в `useEffect` с пустыми зависимостями. Изменения языка, темы, размера шрифта применяются через `dispatch({ effects })` или CSS-переменные, без пересоздания View.

### SPA fallback на локальной разработке
В `vite.config.ts` прокси:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:8080',
    '/ws': { target: 'ws://localhost:8080', ws: true },
  }
}
```

### Предотвращение утечек памяти
При размонтировании `RoomPage`:
- `provider.destroy()` (disconnect + cleanup awareness)
- `ydoc.destroy()`
- `view.destroy()` (CodeMirror)

---

## Что не реализуется (out of scope)

- Чат
- Выполнение кода
- Авторизация / регистрация
- Несколько вкладок/файлов в комнате
- Сохранение кода на диск
