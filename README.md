# Мессенджер — веб-интерфейс на GREEN-API

Тестовое задание на позицию «Frontend разработчик React». Клиентское приложение:
отправляет и принимает текстовые сообщения через **GREEN-API**, все запросы идут
напрямую из браузера. Параметры инстанса (`apiUrl`, `idInstance`,
`apiTokenInstance`) вводятся в интерфейсе и хранятся в `localStorage`.

**Стек:** Vite 8, React 19, TypeScript, [`@maxhub/max-ui`](https://github.com/max-messenger/max-ui),
SCSS Modules, `@tanstack/react-virtual`, ProseMirror (поле ввода),
`react-toastify`, Vitest + React Testing Library.

## Запуск

Нужен **pnpm** (версия зафиксирована в `packageManager`).

```bash
pnpm install
pnpm dev         # http://localhost:5173
pnpm build       # tsc -b + сборка в dist/
pnpm test        # Vitest
pnpm lint        # oxlint + stylelint
```

## Деплой

Статическая сборка из `dist/` публикуется в Cloudflare Workers через Wrangler
(`wrangler.jsonc`). GitHub Actions (`.github/workflows/deploy.yml`) на каждый
push и pull request запускает lint, тесты и сборку, а push в `main` ещё и
деплоит. Для деплоя в репозитории нужны секреты `CLOUDFLARE_API_TOKEN`
(шаблон «Edit Cloudflare Workers») и `CLOUDFLARE_ACCOUNT_ID`. Вручную:
`pnpm run deploy`.

## Методы GREEN-API

| Задача                    | Метод                                                   |
| ------------------------- | ------------------------------------------------------- |
| Проверка подключения      | `GetStateInstance`, `GetAccountSettings`, `GetSettings` |
| Поиск аккаунта            | `CheckAccount` — по номеру или по `@username`           |
| Имя и аватар контакта     | `GetContactInfo`                                        |
| Список диалогов           | `GetChats`                                              |
| Превью чатов              | `LastIncomingMessages` + `LastOutgoingMessages`         |
| История открытого чата    | `GetChatHistory`                                        |
| Отправка текста           | `SendMessage`                                           |
| Приём сообщений и статусы | `ReceiveNotification` + `DeleteNotification`            |

Входящие приходят long-polling'ом (технология HTTP API):
`ReceiveNotification` держит соединение до 25 секунд, уведомление
подтверждается `DeleteNotification`, затем цикл повторяется. Обрабатываются
`incomingMessageReceived`, `outgoingAPIMessageReceived`,
`outgoingMessageReceived` и `outgoingMessageStatus`; дедупликация по
`idMessage`. При обрыве связи — экспоненциальный backoff (1…15 с) и короткие
пробные запросы по 5 с, чтобы сразу заметить восстановление сети; HTTP 429
считается временной ошибкой.

## Архитектура

```
src/
  api/          greenApi.ts (клиент, очередь запросов), types.ts (DTO)
  components/   страницы, три панели оболочки (ChatList, ChatView, ChatProfile),
                Composer, NewChatModal и др. + *.module.scss и *.test.tsx
  hooks/        useSession (учётные данные), useMessenger (состояние и опрос)
  utils/        format.ts, search.ts
```

Особенности:

- **Очередь запросов:** GREEN-API пропускает около 1 запроса в секунду, поэтому
  короткие запросы идут через очередь с интервалом 1,1 с; long-polling — вне
  очереди. Запросы, которых ждёт пользователь (отправка, история, поиск),
  обгоняют фоновые (профили контактов); отменённый запрос покидает очередь, не
  занимая слот.
- **Квота `GetContactInfo`:** метод тарифицируется помесячно; после первого
  ответа HTTP 466 профили больше не запрашиваются, у чатов остаются инициалы.
- **Оптимистичная отправка:** сообщение появляется сразу, поле ввода сразу
  свободно для следующего; затем сообщение получает серверный id и статус из
  `outgoingMessageStatus` (одна галочка — отправлено, две — доставлено, две
  цветные — прочитано). При ошибке оно помечается красным, а текст возвращается
  в поле ввода.
- **Нетекстовые сообщения** (фото, стикер, опрос…) показываются подписью
  «Стикер», «Фото: подпись» — переписка не выглядит односторонней. Ссылки в
  тексте кликабельны. Чат с самим собой называется «Избранное».
- **Адаптивность:** < 1180 px скрывается профиль, < 760 px список чатов и
  переписка переключаются отдельными экранами. Тёмная тема следует системной.
- **Новый чат** — это поиск (`CheckAccount`): строка в списке появляется только
  вместе с первым сообщением.
- **Состояние инстанса** (выключенные уведомления, ошибка соединения, ожидание
  авторизации) показывается в подвале списка чатов только когда требует внимания.
