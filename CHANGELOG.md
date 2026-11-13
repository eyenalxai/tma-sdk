# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.3.0

### Minor Changes

- e32594a: Add third-party Ed25519 init-data validation with `validateInitDataSignature()`, and expose the `chat_join_request_query_id` init-data field.
- 8e37140: Replace `createTelegramSession()` with a synchronous `createSession()` lifecycle. Init data is nullable and `requireInitData()` throws only when called. A passive bridge captures stateful events from module import, keeps their last payload and replays it to the first subscriber, including events that arrive before `createSession()`. `start()` mounts the viewport and requests initial state, while `markReady()` is separate and only takes effect after mount; both `start()` and `destroy()` are idempotent. The read-only session status moves `launched` → `mounted` → `ready` → `closed`, and a failed start stays `failed` until `destroy()`.

  Breaking release (0.3.0):

  - `createSession()` returns a `Session` with `launch`, `initData`, `protocol`, `features`, `status`, `start`, `markReady` and `destroy`. The `telegram` object, `createTelegramSession()`, `TelegramProvider` and `useTelegram` are removed with no compatibility layer.
  - `/react` exports `SessionProvider` and `useSession`. The provider exposes `onError` and `autoReady` (default `false`, so the app calls `markReady()`), and `expand` and `disableVerticalSwipes` default to `false`.

- af0ce2e: Reconcile native chrome when the session starts. The back-button controller gains `sync()`, which posts the desired visibility once even when the store already matches, so a native reload converges; `show()` and `hide()` keep sending only changes. Fullscreen transitions treat `ALREADY_FULLSCREEN` as success for entering and exiting the mode, while `UNSUPPORTED` still rejects. Partial `safe_area_changed` and `content_safe_area_changed` payloads are accepted and merged into the stored insets instead of replacing them.
- a595b75: Replace the ad-hoc feature objects with one registry of uniform controllers. `session.features` now exposes `theme`, `viewport`, `backButton`, `mainButton`, `secondaryButton`, `settingsButton`, `closingBehavior`, `swipeBehavior`, `haptics`, `links`, `downloads`, `writeAccess`, `dialogs` and `clipboard`; every controller has `supported`, a read-only `state` store and `actions`. `supported` comes from the protocol table, so no separate version table exists.

  The theme controller derives `colorScheme` from `theme_params.bg_color` with the same HSP formula as Telegram's official script; the client does not send a color scheme.

  Breaking release (0.3.0):

  - `miniApp` is removed. `markReady()` sends `web_app_ready`, and the header, background and bottom-bar colors move to `theme`.
  - The viewport, back-button, haptics, links, downloads and write-access objects are replaced by controllers. Actions live under `actions` (`viewport.actions.expand()`, `backButton.actions.show()`, and so on) and state lives under `state`; `viewport.mount()` and `backButton.sync()` stay session-owned.
  - The links methods move under `links.actions`: use `links.actions.open()` for `openLink` and `links.actions.openTelegram()` for `openTelegramLink`.
  - `downloads.actions.request()` resolves with `"downloading"` or `"cancelled"` instead of throwing when the user cancels.
  - `theme`, the main, secondary and settings buttons, the closing behavior, `dialogs` and `clipboard` are new. `session.protocol.invoke()` remains the escape hatch for methods without a controller.

- 011f3be: Replace the four wire modules with one protocol table and one transport adapter. The protocol exposes typed `invoke`, `on`, `request`, tri-state `supports`, `mayInvoke` and parameter-level availability; it routes through the native proxy, the legacy notify channel or an iframe with a Telegram Web origin allowlist, installs all three inbound receive-event globals, and reports the method, platform and version on a request timeout.

  Breaking release (0.3.0):

  - The internal `post-event`, `version`, `event-schemas`, `event-bridge`, `event-hub` and `request` modules are removed with no compatibility layer.
  - The session `markReady()` does not send `web_app_ready` on `tdesktop` and `windows`, where the client does not implement the method.
  - `theme.actions.setHeaderColor()` does not send an RGB color below Mini Apps 6.9; the keyword colors still work.

- 14c685e: Serialize one request per Telegram method. A second call for the same method queues behind the active one in call order and starts its own wire request when the first settles. A queued call's timeout starts only when it takes its turn, and a per-request `signal` aborts that call alone, including before its turn.

  Replies now correlate on the id the request sent: `req_id` for clipboard, custom method, request-chat and device/secure storage requests, and `slug` for invoices. A stale reply for another id no longer settles the wrong request, and callers no longer pass a predicate to read the payload themselves.

- 5d04fb3: Replace the platform boolean with a capability table. `getPlatform(name)` reports `kind`, `supportsViewport` and `isEmbeddedWeb` for every observed Telegram client, and viewport mount requests the viewport only when the platform answers it.

  Breaking release (0.3.0):

  - `isDesktopPlatform` is removed. Read `getPlatform(name).kind` for the client class (`mobile`, `desktop`, `web` or `unknown`), and `getPlatform(name).supportsViewport` for whether the client provides a usable viewport height. The old desktop layout set is `kind === "desktop" || kind === "web"`. macOS no longer requests the null viewport and uses the window height.

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
