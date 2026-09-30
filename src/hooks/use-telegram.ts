import type { Telegram } from "@eyenalxai/tma-sdk/lib/telegram"

import { createContext, use } from "react"

const TelegramContext = createContext<Telegram | null>(null)

const useTelegram = (): Telegram => {
  const telegram = use(TelegramContext)
  if (telegram === null) {
    throw new Error("useTelegram must be used within a TelegramProvider")
  }
  return telegram
}

export { TelegramContext, useTelegram }
