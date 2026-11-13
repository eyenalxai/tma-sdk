# @eyenalxai/tma-sdk

TypeScript SDK for Telegram Mini Apps with React bindings and server init-data validation.

This package is unofficial and is not affiliated with Telegram.

## Installation

```sh
npm install @eyenalxai/tma-sdk
```

React is required only when using the `/react` entry point:

```sh
npm install @eyenalxai/tma-sdk react
```

## Entry points

- `@eyenalxai/tma-sdk` exports framework-neutral Mini App session and launch-data APIs.
- `@eyenalxai/tma-sdk/react` exports the React provider and hooks.
- `@eyenalxai/tma-sdk/server` exports Node.js init-data validation helpers.

The root entry is safe to import during server rendering, but functions such as `createSession()` and `retrieveLaunchParams()` must be called in a browser launched by Telegram.

## React usage

```tsx
import { SessionProvider, useSession } from "@eyenalxai/tma-sdk/react"
import { useEffect } from "react"

const App = () => (
  <SessionProvider fallback={null}>
    <Main />
  </SessionProvider>
)

const Main = () => {
  const session = useSession()

  useEffect(() => {
    session.markReady()
  }, [session])

  return <div>User: {session.initData?.user?.first_name ?? "Unknown"}</div>
}
```

`SessionProvider` creates the session on the client, mounts the viewport, binds Telegram's viewport and safe-area CSS variables (`--tg-viewport-height`, `--tg-viewport-stable-height`, `--tg-safe-area-inset-*`, `--tg-content-safe-area-inset-*`), and destroys the session when unmounted. It renders `fallback` until the session starts.

The provider leaves readiness to the app by default. Call `session.markReady()` when your first screen is ready, or set `autoReady` to mark the Mini App ready as soon as `start()` resolves. Pass `onError` to receive initialization failures instead of throwing to the nearest React error boundary. `expand` and `disableVerticalSwipes` default to `false`, so the provider does not change native behavior unless asked.

## Client usage

```ts
import { createSession } from "@eyenalxai/tma-sdk"

const session = createSession()

await session.start()
session.markReady()
session.features.viewport.expand()

// Later, when leaving the Mini App:
session.destroy()
```

`createSession()` returns synchronously and installs the Telegram event bridge before any await. Init data is nullable because some launches have none; call `session.requireInitData()` when the app cannot work without it. A passive bridge captures viewport, fullscreen, safe-area, theme and visibility events from module import, so an event that arrives before `createSession()` is delivered to the first subscriber. Stateful events then keep their last payload and replay it to a later subscriber.

The read-only session status moves from `launched` to `mounted` and then `ready`, and ends at `closed` after `destroy()`. A failed start leaves it at `failed` until `destroy()`; `markReady()` only takes effect after mount.

## Launch parameters and init data

```ts
import { parseInitData, parseLaunchParams, retrieveLaunchParams } from "@eyenalxai/tma-sdk"

const launchParams = retrieveLaunchParams()
const initData = parseInitData(launchParams.tgWebAppData ?? "")
const parsedLaunchParams = parseLaunchParams(new URLSearchParams(location.search))
```

`retrieveLaunchParams()` preserves validated Telegram launch parameters in session storage so client-side navigation does not discard the original launch context.

## Platform capability

```ts
import { getPlatform, retrieveLaunchParams } from "@eyenalxai/tma-sdk"

const platform = getPlatform(retrieveLaunchParams().tgWebAppPlatform)

platform.kind // "mobile" | "desktop" | "web" | "unknown"
platform.supportsViewport // true when the client provides a usable viewport height
platform.isEmbeddedWeb // true for web, weba and webk
```

`getPlatform()` replaces `isDesktopPlatform()`. The old desktop predicate is `kind === "desktop" || kind === "web"`; use `supportsViewport` for the viewport request strategy. macOS is a desktop client that answers with a null payload, so it does not request a viewport and uses the window height.

## Server validation

```ts
import { validateInitData } from "@eyenalxai/tma-sdk/server"

const initData = validateInitData(rawInitData, process.env.BOT_TOKEN, {
  expiresIn: 86_400,
})
```

`validateInitData()` verifies the Telegram HMAC, validates `auth_date`, applies expiration, parses the signed payload, and throws on failure. Use `isInitDataValid()` when a boolean check is preferred.

A third party without the bot token can verify the same init data with Telegram's Ed25519 public key:

```ts
import { validateInitDataSignature } from "@eyenalxai/tma-sdk/server"

const initData = validateInitDataSignature(rawInitData, {
  botId: 1234567890,
  publicKey: "e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d",
  expiresIn: 86_400,
})
```

Pass Telegram's production key for production init data and the test key for test-environment data. The key is the raw 32-byte hex value from the Telegram documentation.

Keep the bot token server-side. Never expose it to Mini App client code.

## Requirements

- Node.js `^22.18.0`, `^24.11.0`, or `>=26.0.0` for the `/server` entry point.
- React 19 or newer for the `/react` entry point.
- A browser environment launched inside Telegram for Mini App session APIs.
- ESM-compatible module resolution.

## License

[MIT](./LICENSE)
