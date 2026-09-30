import { createContext, use } from "react"

import type { Telegram } from "#lib/telegram"

const TelegramContext = createContext<Telegram | null>(null)

const useTelegram = (): Telegram => {
  const telegram = use(TelegramContext)
  if (telegram === null) {
    throw new Error("useTelegram must be used within a TelegramProvider")
  }
  return telegram
}

export { TelegramContext, useTelegram }
