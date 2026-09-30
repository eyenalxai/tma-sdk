# Telegram Mini App SDK

TypeScript APIs for Telegram Mini App client sessions, React integration, and server-side launch-data validation.

## Language

### Launch data

**Mini App launch parameters**:
Telegram-provided URL parameters that describe the current Mini App launch, including platform and Mini Apps version.
_Avoid_: launch context, Telegram settings

**Mini App init data**:
Telegram-signed launch data identifying the Mini App user and related context.
_Avoid_: auth payload, Telegram profile

**Init-data validation**:
Server-side verification of Mini App init data against the bot token signature and expiration rules.
_Avoid_: login validation, token validation

### Session and protocol

**Mini App session**:
The client-side lifecycle that owns Telegram launch data, client event subscriptions, feature controllers, and teardown.
_Avoid_: Telegram context, SDK instance

**Telegram event bridge**:
The client-side communication layer connecting the Mini App to Telegram's event transport for web or native clients.
_Avoid_: event bus, WebView bridge

**Telegram method**:
A command a Mini App sends to the Telegram client over the Telegram event bridge.
_Avoid_: request, API call, command

**Telegram event**:
A message a Telegram client sends to a Mini App over the Telegram event bridge.
_Avoid_: message, callback, notification

**Mini Apps version**:
The version of the Mini Apps protocol supported by the Telegram client that launched the Mini App, reported in launch parameters.
_Avoid_: app version, client version, Telegram version

**Feature controller**:
One of the per-feature objects a Mini App session exposes (back button, viewport, haptics, and so on).
_Avoid_: module, service, manager

### Platforms and viewport

**Platform**:
The identifier of the Telegram client that launched the Mini App, reported in launch parameters (for example `ios`, `android`, `tdesktop`, `windows`, `web`).
_Avoid_: device type, operating system

**Desktop platform**:
A platform whose client lays out the Mini App without resizing its viewport, so viewport state stays stable.
_Avoid_: non-mobile platform, desktop client

**Viewport state**:
The Mini App window state observed by a session: height, stable height, expansion, fullscreen, and safe area insets.
_Avoid_: window size, screen metrics

**Safe area insets**:
Insets applied to avoid system UI such as notches and the keyboard.
_Avoid_: padding, viewport insets

**Content safe area insets**:
Insets applied to avoid Telegram's own client UI overlays.
_Avoid_: safe area insets (they are different)
