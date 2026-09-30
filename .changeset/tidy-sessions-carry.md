---
"@eyenalxai/tma-sdk": minor
---

Rework the client session for long-term maintenance:

- Viewport CSS custom properties now use the names Telegram documents and `telegram-web-app.js` sets: `--tg-safe-area-inset-*` and `--tg-content-safe-area-inset-*` (previously `--tg-viewport-safe-area-inset-*` and `--tg-viewport-content-safe-area-inset-*`). `--tg-viewport-width` was dropped.
- New `isDesktopPlatform(platform)` export for platforms whose client does not resize the Mini App viewport.
- `TelegramProvider` and `createTelegramSession` no longer wait for safe-area state during mount. Safe-area requests are best-effort, which removes a five-second stall on Web K and Unigram.
- Requests now have timeouts: ten seconds by default, five minutes for user-confirmation flows such as write access and file downloads.
- Internals were restructured around a per-session event hub over a shared event bridge, a disposer that owns session teardown, and a dedicated viewport CSS variable binder.
