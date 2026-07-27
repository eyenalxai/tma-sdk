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

The root entry is safe to import during server rendering, but functions such as `createTelegramSession()` and `retrieveLaunchParams()` must be called in a browser launched by Telegram.

## React usage

```tsx
import { TelegramProvider, useTelegram } from "@eyenalxai/tma-sdk/react"

const App = () => (
  <TelegramProvider fallback={null}>
    <Main />
  </TelegramProvider>
)

const Main = () => {
  const telegram = useTelegram()

  return <div>User: {telegram.initData.user?.first_name ?? "Unknown"}</div>
}
```

`TelegramProvider` creates the session on the client, mounts the viewport, binds Telegram viewport CSS variables, marks the Mini App ready, and destroys the session when unmounted. Initialization failures are thrown to the nearest React error boundary.

## Client usage

```ts
import { createTelegramSession } from "@eyenalxai/tma-sdk"

const session = createTelegramSession()

await session.telegram.viewport.mount()
session.telegram.miniApp.ready()
session.telegram.viewport.expand()

// Later, when leaving the Mini App:
session.destroy()
```

## Launch parameters and init data

```ts
import { parseInitData, parseLaunchParams, retrieveLaunchParams } from "@eyenalxai/tma-sdk"

const launchParams = retrieveLaunchParams()
const initData = parseInitData(launchParams.tgWebAppData ?? "")
const parsedLaunchParams = parseLaunchParams(new URLSearchParams(location.search))
```

`retrieveLaunchParams()` preserves validated Telegram launch parameters in session storage so client-side navigation does not discard the original launch context.

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

- Node.js 20.19.0 or newer for the `/server` entry point.
- React 19 or newer for the `/react` entry point.
- A browser environment launched inside Telegram for Mini App session APIs.
- ESM-compatible module resolution.

## License

[MIT](./LICENSE)
