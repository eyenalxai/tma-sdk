import type { Telegram, TelegramSession } from "@eyenalxai/tma-sdk/lib/telegram"
import type { PropsWithChildren, ReactNode } from "react"

import { TelegramContext } from "@eyenalxai/tma-sdk/hooks/use-telegram"
import { createTelegramSession } from "@eyenalxai/tma-sdk/lib/telegram"
import { useEffect, useState } from "react"

type TelegramProviderProps = PropsWithChildren<{
  /**
   * Rendered instead of children while the session is being created
   * (during SSR and the first client render).
   */
  fallback?: ReactNode
  /**
   * Expand the Mini App to the maximum available height after mounting.
   * @default true
   */
  expand?: boolean
  /**
   * Disable vertical swipes (pull-to-close) after mounting.
   * @default true
   */
  disableVerticalSwipes?: boolean
}>

const toError = (cause: unknown, message: string): Error =>
  cause instanceof Error ? cause : new Error(message, { cause })

type TelegramProviderState =
  | { status: "pending" }
  | { status: "ready"; telegram: Telegram }
  | { status: "failed"; error: Error }

const pendingState: TelegramProviderState = { status: "pending" }

const TelegramProvider = ({
  children,
  fallback = null,
  expand = true,
  disableVerticalSwipes = true,
}: TelegramProviderProps): ReactNode => {
  const [state, setState] = useState<TelegramProviderState>(pendingState)

  useEffect(() => {
    let active = true
    let session: TelegramSession | null = null
    let unbindCssVars: (() => void) | null = null

    const initialize = async () => {
      try {
        session = createTelegramSession()
        await session.telegram.viewport.mount()
        if (!active) {
          return
        }

        unbindCssVars = session.telegram.viewport.bindCssVars()
        session.telegram.miniApp.ready()
        setState({ status: "ready", telegram: session.telegram })
      } catch (error) {
        session?.destroy()
        session = null
        if (active) {
          setState({ status: "failed", error: toError(error, "Failed to initialize Telegram") })
        }
      }
    }
    void initialize()

    return () => {
      active = false
      unbindCssVars?.()
      session?.destroy()
    }
  }, [])

  const telegram = state.status === "ready" ? state.telegram : null

  useEffect(() => {
    if (telegram !== null && expand) {
      telegram.viewport.expand()
    }
  }, [expand, telegram])

  useEffect(() => {
    const restoreSwipeBehavior =
      telegram === null
        ? undefined
        : () => {
            telegram.swipeBehavior.enableVertical()
          }

    if (telegram !== null) {
      if (disableVerticalSwipes) {
        telegram.swipeBehavior.disableVertical()
      } else {
        telegram.swipeBehavior.enableVertical()
      }
    }

    return restoreSwipeBehavior
  }, [disableVerticalSwipes, telegram])

  if (state.status === "failed") {
    throw state.error
  }
  if (state.status === "pending") {
    return fallback
  }

  return <TelegramContext.Provider value={state.telegram}>{children}</TelegramContext.Provider>
}

export { TelegramProvider, type TelegramProviderProps }
