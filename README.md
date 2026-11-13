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

const App = () => (
  <SessionProvider fallback={null}>
    <Main />
  </SessionProvider>
)

const Main = () => {
  const session = useSession()

  return <div>User: {session.initData?.user?.first_name ?? "Unknown"}</div>
}
```

`SessionProvider` creates the session on the client, mounts the viewport, binds Telegram's viewport and safe-area CSS variables (`--tg-viewport-height`, `--tg-viewport-stable-height`, `--tg-safe-area-inset-*`, `--tg-content-safe-area-inset-*`), marks the Mini App ready, and destroys the session when unmounted. It renders `fallback` until the session starts.

Set `autoReady={false}` to call `markReady()` yourself. Pass `onError` to receive initialization failures instead of throwing to the nearest React error boundary. `expand` and `disableVerticalSwipes` default to `false`, so the provider does not change native behavior unless asked.

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

`createSession()` returns synchronously and installs the Telegram event bridge before any await. Init data is nullable because some launches have none; call `session.requireInitData()` when the app cannot work without it. Stateful events (viewport, fullscreen, safe area, theme and visibility) keep their last payload and replay it to a late subscriber, so state that arrives before React renders is not lost.

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

`validateInitData()` verifies the Telegram signature, validates `auth_date`, applies expiration, parses the signed payload, and throws on failure. Use `isInitDataValid()` when a boolean check is preferred.

Keep the bot token server-side. Never expose it to Mini App client code.

## Requirements

- Node.js `^22.18.0`, `^24.11.0`, or `>=26.0.0` for the `/server` entry point.
- React 19 or newer for the `/react` entry point.
- A browser environment launched inside Telegram for Mini App session APIs.
- ESM-compatible module resolution.

## License

[MIT](./LICENSE)
