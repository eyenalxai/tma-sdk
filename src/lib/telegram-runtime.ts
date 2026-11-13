import type { Disposer } from "./disposer"
import type { Protocol } from "./protocol/client"

type TelegramRuntime = {
  protocol: Protocol
  disposer: Disposer
}

export type { TelegramRuntime }
