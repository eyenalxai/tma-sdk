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
Server-side verification of Mini App init data against the bot-token HMAC or Telegram's Ed25519 public key, plus expiration rules.
_Avoid_: login validation, token validation

### Session and protocol

**Mini App session**:
The client-side lifecycle that owns Telegram launch data, client event subscriptions, feature controllers, and teardown.
_Avoid_: Telegram context, SDK instance

**Session status**:
The read-only lifecycle state of a Mini App session: `launched` before `start()`, `mounted` after the viewport mounts, `ready` after `markReady()`, `failed` when start fails, and `closed` after `destroy()`. `failed` is terminal until destroy.
_Avoid_: session state, lifecycle phase

**Telegram event bridge**:
The client-side communication layer connecting the Mini App to Telegram's event transport for web or native clients.
_Avoid_: event bus, WebView bridge

**Protocol table**:
The single source for every Telegram method's wire name, params, response events, introduced version, raw-payload flag and per-platform capability.
_Avoid_: method registry, wire map

**Transport adapter**:
The layer that sends protocol messages over the native proxy, the legacy `window.external.notify` channel or the iframe `postMessage` channel, and installs the inbound receive-event globals.
_Avoid_: bridge, post-event

**Method capability**:
The tri-state answer for whether a Telegram method is available: `supported`, `unsupported` or `unknown`. Only hard evidence produces `unsupported`.
_Avoid_: support flag, feature flag, capability (ambiguous with platform capability)

**Telegram method**:
A command a Mini App sends to the Telegram client over the Telegram event bridge.
_Avoid_: request, API call, command

**Telegram event**:
A message a Telegram client sends to a Mini App over the Telegram event bridge.
_Avoid_: message, callback, notification

**Mini Apps version**:
The version of the Mini Apps protocol supported by the Telegram client that launched the Mini App, reported in launch parameters.
_Avoid_: app version, client version, Telegram version

**Feature registry**:
The `session.features` object that groups every feature controller under one uniform contract: `supported`, `state` and `actions`.
_Avoid_: feature bag, API surface

**Feature controller**:
One of the per-feature objects a Mini App session exposes (back button, viewport, haptics, and so on). Every controller exposes `supported` from the protocol table, a read-only `state` store and user-facing `actions`.
_Avoid_: module, service, manager

### Platforms and viewport

**Platform**:
The identifier of the Telegram client that launched the Mini App, reported in launch parameters (for example `ios`, `android`, `tdesktop`, `windows`, `web`).
_Avoid_: device type, operating system

**Platform capability**:
The client-dependent behavior a Mini App reads from the launch platform: the platform kind (`mobile`, `desktop`, `web` or `unknown`), whether the client provides a usable viewport height, and whether it is an embedded web client.
_Avoid_: desktop flag, platform boolean

**Viewport state**:
The Mini App window state observed by a session: height, stable height, expansion, fullscreen, and safe area insets.
_Avoid_: window size, screen metrics

**Safe area insets**:
Insets applied to avoid system UI such as notches and the keyboard.
_Avoid_: padding, viewport insets

**Content safe area insets**:
Insets applied to avoid Telegram's own client UI overlays.
_Avoid_: safe area insets (they are different)
