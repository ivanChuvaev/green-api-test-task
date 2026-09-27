# AGENTS.md

## Project

Frontend-only messenger web client for a GREEN-API instance. The user enters
`apiUrl`, `idInstance`, `apiTokenInstance`, starts a chat by phone number, sends
text messages and receives replies in the same chat. No backend: every request goes
from the browser straight to GREEN-API. Incoming messages come from HTTP API long
polling (`ReceiveNotification` + `DeleteNotification`). Text messages only.

## Commands

Use **pnpm** only (never npm or yarn).

```bash
pnpm dev              # dev server on http://localhost:5173
pnpm build            # tsc -b + production build
pnpm test             # Vitest, once
pnpm lint             # oxlint + stylelint
pnpm lint:fix         # prettier --write over src
pnpm test:e2e         # Playwright against the real API (needs .env); run before a release only
```

After any change run `pnpm test`, `pnpm lint` and `pnpm build`.

## Stack

React 19 + TypeScript (strict), Vite 8, `@maxhub/max-ui` + SCSS Modules
(camelCase BEM), `clsx`, `@tanstack/react-virtual`, ProseMirror (plain text),
`vite-plugin-svgr` icons, `react-toastify`, Vitest + React Testing Library,
Prettier, oxlint, stylelint, Husky + lint-staged. No state-management library.

## Code conventions

- **Named exports only.** No `export default` (except svgr SVG modules).
- No `any`, no non-null assertions. Use `import type` for types and precise unions
  over `string`.
- Function components with typed props, no `React.FC`.
- Prettier is the formatter of record (no semicolons, single quotes, 100 cols).
  Never bypass hooks with `--no-verify`.
- State lives in the component that needs it, lifted to the closest common owner.
  The exception is the messenger state machine in `useMessenger`, consumed by
  `ChatPage`. Store updates are functional `setState` through the pure updaters in
  `messengerStore.ts`; never mutate state.
- Effects only synchronise with external systems (polling loop, instance info,
  dialog list). Long-running loops are cleaned up with an `AbortController`.
- **`className` with more than one class uses `clsx`**, never template literals,
  `&&` or ternaries leaving an empty string. A single class stays a plain value.
  Keep base and modifier as separate `clsx` arguments.
  `clsx(styles.chatItem, active && styles.chatItemActive)`.
- **Every form is its own `*Form` component** (`LoginForm`, `NewChatForm`). It
  contains only the `<form>`, fields, validation error, submit button and its own
  styling. Page/modal layout stays in the host. Each has its own
  `*.module.scss` block. The form owns its state and exposes `initial` and/or a
  result callback (`onConnect`, `onFind`); it calls `src/api/greenApi.ts` or the
  callback, never `fetch`.
- Dialogs render through `Modal` (backdrop, card, header, close on the button, the
  backdrop and `Escape`, focus returned on close) and are mounted only while open,
  so a reopened dialog starts clean.
- Icons: add the `.svg` to `src/assets/icons`, import it in `Icon.tsx`, add it to
  the `icons` map and to `IconName`, use `<Icon name="..." />`. Icons are bundled
  eagerly (a lazy status mark would appear after its message).

## Layout

Three panels, named by role, never by position. Each renders its own `shell.pane`
wrapper and `data-pane`; `ChatPage` owns the shell (`Shell.module.scss`) and
`activeChat`.

| Panel         | Component     | Owns                                            |
| ------------- | ------------- | ----------------------------------------------- |
| `chatList`    | `ChatList`    | account header, search, the dialogs, the footer |
| `chatView`    | `ChatView`    | the header, the messages and the composer       |
| `chatProfile` | `ChatProfile` | what is known about the contact                 |

- No chat selected: `ChatView` still renders, with the `chatViewEmpty` modifier
  (`grid-column: 2 / -1`) and a hint; `ChatHeader`, `MessageList`, `Composer` and
  `ChatProfile` are unmounted. The shell has one modifier, `shellChatOpen`; do not
  add a second one, it out-specifies the media queries and breaks the mobile
  layout.
- `ChatHeader` shows the number of the contact and the connection state only
  while it is broken: "online" next to a contact would read as their presence,
  which the API does not report.
- Skeletons: the list rows (`ChatItemSkeleton`) while dialogs load, one row for a
  chat with `profileLoading` (created without a name, resolved by `getContactInfo`
  through `resolveProfile`), and `AccountSkeleton` while `currentUser` is null.
- `Escape` calls `selectChat('')` (same as the back button). The window listener is
  bound only while a chat is selected and no dialog is open; an open dialog
  closes on `Escape` itself.
- Instance-level messages live in the chat list footer (`ConnectionBanners`),
  gated by `useMessenger`'s `needsAttention`.
- The search is the state of `ChatList` itself, not of `ChatPage`: `query`,
  `searchChats` (`src/utils/search.ts`) and the count of the matches are one
  decision in one place, and the query survives opening a chat, so `Escape` comes
  back to the same rows. A query matches the title (a name, a `@username` or a
  formatted number), then the preview, then the digits of the number. A title is
  searched as text and a number is searched as digits: never compare a
  digit-free query to a number, an empty needle is a substring of every one of
  them. The field keeps its Russian `placeholder` **and** `aria-label`, because
  the unit tests and the e2e actions address it by both.

## API layer

All GREEN-API calls go through `src/api/greenApi.ts`; components and hooks never
call `fetch`. Preserve:

- **Rate limit**: about 1 request/s per instance. Short requests go through a queue
  with a 1.1 s gap; 429 is transient. The queue has two priorities: `foreground`
  (default: everything the user waits for) overtakes `background` (contact
  profiles). A request aborted while it waits leaves the queue without taking a
  slot. Long polling skips the queue and is retried by the polling loop.
- **Long polling**: `receiveNotification` blocks up to 25 s and must be confirmed
  with `deleteNotification` before the next one. An empty round ends with HTTP 408
  (or 200 `null`); both prove the connection, so either one clears an error. While
  the connection is down the loop probes with the minimum 5 s poll and a backoff
  capped at 15 s. A failed instance read is retried on its own as well.

Hydration merges into the store through the pure `mergeChats` / `mergeJournal` /
`mergeHistory` updaters, which skip messages already delivered (the same
`idMessage` can arrive by notification, journal and history).

Invariants:

- **Messages of a chat stay ascending by timestamp.** `appendMessage` inserts at
  the right position (journals reach further back than a history page); an older
  message does not change the chat list preview. Unsorted input duplicates day
  separators and their keys, which breaks React and the virtualizer.
- **`checkAccount` never creates a chat.** A row enters the list with the first
  message: `findChat` keeps the found contact in its own `resolved` state,
  `activeChat` falls back to it, and `send` / `applyNotification` upsert the row.
- **A real contact name always wins** over a `@username` or formatted phone
  placeholder. `getChats` supplies names; `getContactInfo` fills them for contacts
  found through the dialog.
- **Avatars come only from `getContactInfo`**: `getChats` carries none. So every
  chat without an avatar is asked for its profile once (`profilesRequested`,
  `background` priority), not only the nameless ones; `resolveProfile` replaces a
  title only while the chat is a `profileLoading` placeholder. Render every avatar
  through `ChatAvatar` (image, or initials when empty), never with a bare
  `Avatar.Text`. The method counts against a monthly plan quota: the first
  `QUOTE_EXCEEDED` (HTTP 466) sets `profilesExhausted`, aborts the queued profile
  requests and settles every placeholder on its fallback title; it is not a bug.
- **`senderData` is the author of a message**: the contact for an incoming one in a
  private chat, a member in a group, **the account itself** for an outgoing one.
  Only the first names a chat and gives it a phone number (`applyNotification`);
  the journals follow the same rule (`senderId === chatId`). An outgoing
  notification names a chat only when it creates it (`chatName`).
- **Non-text messages** of the kinds in `attachmentLabels` (photo, sticker, poll…)
  are kept with an `attachment` label (the caption is their text), so a chat does
  not look one-sided; reactions, edits and service messages are skipped. The text
  of a link or a reply is `extendedTextMessageData.text`.
- **The chat with the account itself** is titled `SELF_CHAT_TITLE` ("Избранное")
  by `useMessenger` when it hands the chats out; the store keeps the real name.
- **`CurrentUser`** is assembled by `loadCurrentUser` and `rememberOwnName`. No
  account method carries a name: `getAccountSettings` answers with the number, the
  own `chatId`, the avatar and an empty `username`, and `getChats` answers with an
  empty `name` for the very chat the account has with itself. The name comes from
  the journal of that chat — every message in it is sent by the account, so
  `senderId` is the own `chatId` and `senderName` is our own profile name — and
  from `senderData.senderName` of `outgoingMessageReceived`. The journals are read
  anyway, so the name costs no request. A known name is never overwritten (kept in
  a ref, so a retry cannot drop it). Fallback order: name, `@username`, formatted
  number. The dialogs are requested only once the account is known.

## Message editor and composer

`MessageEditor.tsx` owns the ProseMirror `EditorView`; `plainTextSchema.ts` holds
the schema (`doc → paragraph+ → text*`, no marks) and `readPlainText(doc)`
(paragraphs joined with `\n`), which is what `Composer` sends and measures against
`MAX_MESSAGE_LENGTH`.

- Paste is intercepted (`handlePaste`): only `text/plain`, one paragraph per line.
- `Enter` submits, `Shift-Enter` is `splitBlock`; `baseKeymap` + `history()` for
  the rest.
- Never re-create the view: use `dispatchTransaction`, and reach it from props via
  DOM attributes only. `Composer` clears it through the `MessageEditorHandle` ref
  as soon as a message is submitted (the message is optimistic), never locks it,
  and `restore`s the text when the API refuses the message and the field is still
  empty. `Composer` reads the text from a ref at submit time: `Enter` can follow a
  keystroke before React renders it. `ChatView` keys it by `chatId`, so a draft
  never follows the user into another chat. Over `MAX_MESSAGE_LENGTH` nothing is
  sent.
- The placeholder is a sibling span (ProseMirror always renders a paragraph, so
  `:empty` never matches).
- The field row has **no padding**; the insets are the padding of the editable
  area so any click focuses the editor. The field is flat: no radius, no
  background, no focus ring. `MessageEditor` also handles `mousedown` on its
  host outside the view (focus the view, with `preventDefault`). jsdom has no
  layout, so only e2e can test hit positions.

## Virtualized lists

`MessageList.tsx` and `ChatList.tsx` use `@tanstack/react-virtual`.

- The existing scroll box (`.messages`, `.chatListScroll`, `overflow-y: auto`) is
  the `getScrollElement`. Inside, one relative inner box with `getTotalSize()`
  height holds `position: absolute` rows placed with `translateY(item.start)`; rows
  are `data-index` elements.
- Set `useFlushSync: false` in both (React 19 warns about `flushSync` in lifecycle
  methods); keep a generous `overscan`.
- `MessageList` is end anchored: `anchorTo: 'end'`, `followOnAppend`,
  `scrollEndThreshold: 80`. The rows (`MessageRows`) mount per chat (`key` by
  `chatId`) and only once there are messages, with `initialOffset` / `initialRect`
  at the estimated end and `scrollToEnd()` on mount: a range computed from offset 0
  (or from the previous chat's offset) renders the oldest rows and paints a blank
  frame before jumping. The estimate counts line breaks. A chat shorter than
  the panel is pinned to the bottom by adding the height difference to every row's
  `top`. There is no "load older": `getChatHistory` has no offset.
- `ChatList` items are exactly `68px`: fixed `estimateSize`, no `measureElement`.
- Anything measured uses **padding, never margin** (margins fall outside
  `getBoundingClientRect`). The viewer insets are the virtualizer's
  `paddingStart` / `paddingEnd`.
- `getItemKey` is `` `${chat.chatId}:${row.key}` `` and must be unique (`idMessage`
  or the day a separator opens). A message sent from this tab keeps its temporary
  id as `localId`, and the row keys by it, so swapping in the server id neither
  remounts nor re-measures the bubble.
- The "last 100 messages" notice is a row only when the chat holds a full page of
  history (`HISTORY_LIMIT`).
- No entry animation on rows: they remount every time they scroll into view.

## Project layout

```
src/
  api/          greenApi.ts (typed client, request queue), types.ts (DTOs)
  assets/icons/ *.svg, imported with the `?react` suffix
  components/   components + co-located *.module.scss and *.test.tsx
  hooks/        useMessenger.ts (state + polling), messengerStore.ts (pure
                updaters), useSession.ts (credentials)
  lib/          toast.ts
  styles/       global.scss, _tokens.scss, _mixins.scss
  test/         setup.ts (jest-dom, jsdom polyfills), fixtures.ts (invented data)
  utils/        format.ts (dates, phones, text, links), search.ts (chat query)
```

## Tests

Every instance value a test needs is invented and lives in `src/test/fixtures.ts`
(`credentials`, `account`, `contact`, `contactPhone`); import them, never write
them inline. `contact` is somebody else: use `account.chatId` only for the chat
of the account with itself.

Cover behaviour that can break unnoticed — the store updaters, the request queue,
the polling loop, the composer, the virtualized lists — not markup that only
renders props. The
real host, instance, phone and contact from `.env` belong to the e2e suite alone,
because a committed test would leak them. Mock the API layer in every test, and
use `formatPhone` on the fixture instead of hardcoding a formatted number.

**Manual QA** of a change that touches the API, the hydration or what the panels
show is performed against the real instance with the values from `.env` when the
file exists (through the e2e helpers in `e2e/actions.ts`, or by hand in the
browser), not only with the mocked unit tests. Never print or commit those
values; a throwaway spec is deleted afterwards. If `.env` is missing, say so and
rely on the unit tests.

## Known limitations (deliberate)

- The store is in memory; a chat keeps only the last history page loaded.
- The chat list is ordered by last activity, so a new message moves its chat to
  the top.
- The token is stored in `localStorage` (the task requires entering credentials in
  the UI).
- Text messages only; polling runs only while the tab is open.
