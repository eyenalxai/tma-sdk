# Telegram Mini App SDK

TypeScript APIs for Telegram Mini App client sessions, React integration, and server-side launch-data validation.

## Language

**Mini App launch parameters**:
Telegram-provided URL parameters that describe the current Mini App launch, including platform and Mini Apps version.
_Avoid_: launch context, Telegram settings

**Mini App init data**:
Telegram-signed launch data identifying the Mini App user and related context.
_Avoid_: auth payload, Telegram profile

**Mini App session**:
The client-side lifecycle that owns Telegram launch data, client event subscriptions, feature controllers, and teardown.
_Avoid_: Telegram context, SDK instance

**Telegram event bridge**:
The client-side communication layer connecting the Mini App to Telegram's event transport for web or native clients.
_Avoid_: event bus, WebView bridge

**Init-data validation**:
Server-side verification of Mini App init data against the bot token signature and expiration rules.
_Avoid_: login validation, token validation
