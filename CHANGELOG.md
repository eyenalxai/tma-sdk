# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0

### Minor Changes

- 8868e1d: Rework the client session for long-term maintenance:

  - Viewport CSS custom properties now use the names Telegram documents and `telegram-web-app.js` sets: `--tg-safe-area-inset-*` and `--tg-content-safe-area-inset-*` (previously `--tg-viewport-safe-area-inset-*` and `--tg-viewport-content-safe-area-inset-*`). `--tg-viewport-width` was dropped.
  - New `isDesktopPlatform(platform)` export for platforms whose client does not resize the Mini App viewport.
  - `TelegramProvider` and `createTelegramSession` no longer wait for safe-area state during mount. Safe-area requests are best-effort, which removes a five-second stall on Web K and Unigram.
  - Requests now have timeouts: ten seconds by default, five minutes for user-confirmation flows such as write access and file downloads.
  - Internals were restructured around a per-session event hub over a shared event bridge, a disposer that owns session teardown, and a dedicated viewport CSS variable binder.

### Patch Changes

- 6813663: Refresh runtime and development dependencies and pin Bun 1.4.4.

## 0.1.1

### Patch Changes

- Raise the supported Node.js range to `^22.18.0 || ^24.11.0 || >=26.0.0` and refresh runtime and tooling dependencies.

## 0.1.0

### Added

- Framework-neutral Telegram Mini App session, launch parameter, and init-data APIs.
- React `TelegramProvider`, `useTelegram`, `useViewportState`, and `useIsFullscreen` APIs.
- Node.js Telegram Mini App init-data signature validation.
- Typed ESM entry points for the client SDK, React bindings, and server validation.
