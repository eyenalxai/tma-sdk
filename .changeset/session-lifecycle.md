---
"@eyenalxai/tma-sdk": minor
---

Replace `createTelegramSession()` with a synchronous `createSession()` lifecycle. Init data is nullable and `requireInitData()` throws only when called. Stateful events keep their last payload and replay it to a late subscriber. `start()` mounts the viewport and requests initial state, while `markReady()` stays separate; both `start()` and `destroy()` are idempotent.

Breaking release (0.3.0):

- `createSession()` returns a `Session` with `launch`, `initData`, `protocol`, `features`, `status`, `start`, `markReady` and `destroy`. The `telegram` object, `createTelegramSession()`, `TelegramProvider` and `useTelegram` are removed with no compatibility layer.
- `/react` exports `SessionProvider` and `useSession`. The provider exposes `onError` and `autoReady`, and `expand` and `disableVerticalSwipes` now default to `false`.
