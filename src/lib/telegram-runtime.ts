import type { Disposer } from "./disposer"
import type { EventHub } from "./event-hub"
import type { Request } from "./request"

type TelegramRuntime = {
  version: string
  hub: EventHub
  request: Request
  disposer: Disposer
}

export type { TelegramRuntime }
