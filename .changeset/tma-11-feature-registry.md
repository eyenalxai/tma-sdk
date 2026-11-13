---
"@eyenalxai/tma-sdk": minor
---

Replace the ad-hoc feature objects with one registry of uniform controllers. `session.features` now exposes `theme`, `viewport`, `backButton`, `mainButton`, `secondaryButton`, `settingsButton`, `closingBehavior`, `swipeBehavior`, `haptics`, `links`, `downloads`, `writeAccess`, `dialogs` and `clipboard`; every controller has `supported`, a read-only `state` store and `actions`. `supported` comes from the protocol table, so no separate version table exists.

The theme controller derives `colorScheme` from `theme_params.bg_color` with the same HSP formula as Telegram's official script; the client does not send a color scheme.

Breaking release (0.3.0):

- `miniApp` is removed. `markReady()` sends `web_app_ready`, and the header, background and bottom-bar colors move to `theme`.
- The viewport, back-button, haptics, links, downloads and write-access objects are replaced by controllers. Actions live under `actions` (`viewport.actions.expand()`, `backButton.actions.show()`, and so on) and state lives under `state`; `viewport.mount()` and `backButton.sync()` stay session-owned.
- The links methods move under `links.actions`: use `links.actions.open()` for `openLink` and `links.actions.openTelegram()` for `openTelegramLink`.
- `downloads.actions.request()` resolves with `"downloading"` or `"cancelled"` instead of throwing when the user cancels.
- `theme`, the main, secondary and settings buttons, the closing behavior, `dialogs` and `clipboard` are new. `session.protocol.invoke()` remains the escape hatch for methods without a controller.
