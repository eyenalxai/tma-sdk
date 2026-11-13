import type { Protocol } from "#lib/protocol/client"

import type { Disposer } from "./disposer"

type TelegramRuntime = {
  protocol: Protocol
  disposer: Disposer
}

export type { TelegramRuntime }
