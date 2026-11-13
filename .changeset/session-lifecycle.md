---
"@eyenalxai/tma-sdk": minor
---

Replace `createTelegramSession()` with a synchronous `createSession()` lifecycle. Init data is nullable and `requireInitData()` throws only when called. A passive bridge captures stateful events from module import, keeps their last payload and replays it to the first subscriber, including events that arrive before `createSession()`. `start()` mounts the viewport and requests initial state, while `markReady()` is separate and only takes effect after mount; both `start()` and `destroy()` are idempotent. The read-only session status moves `launched` → `mounted` → `ready` → `closed`, and a failed start stays `failed` until `destroy()`.

Breaking release (0.3.0):

- `createSession()` returns a `Session` with `launch`, `initData`, `protocol`, `features`, `status`, `start`, `markReady` and `destroy`. The `telegram` object, `createTelegramSession()`, `TelegramProvider` and `useTelegram` are removed with no compatibility layer.
- `/react` exports `SessionProvider` and `useSession`. The provider exposes `onError` and `autoReady` (default `false`, so the app calls `markReady()`), and `expand` and `disableVerticalSwipes` default to `false`.
