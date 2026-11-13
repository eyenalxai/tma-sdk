import type { PropsWithChildren, ReactNode } from "react"

import { useEffect, useRef, useState } from "react"

import type { Session } from "#lib/session"

import { SessionContext } from "#hooks/use-session"
import { createSession } from "#lib/session"

type SessionProviderProps = PropsWithChildren<{
  /**
   * Rendered instead of children until the session has started
   * (during SSR, the first client render and viewport mounting).
   */
  fallback?: ReactNode
  /**
   * Called when the session cannot be created or started. When omitted, the
   * error is thrown to the nearest React error boundary instead.
   */
  onError?: (error: Error) => void
  /**
   * Mark the Mini App ready as soon as the session starts.
   * Leave it `false` to call `markReady()` yourself.
   * @default false
   */
  autoReady?: boolean
  /**
   * Expand the Mini App to the maximum available height after starting.
   * @default false
   */
  expand?: boolean
  /**
   * Disable vertical swipes (pull-to-close) after starting.
   * @default false
   */
  disableVerticalSwipes?: boolean
}>

const toError = (cause: unknown, message: string): Error =>
  cause instanceof Error ? cause : new Error(message, { cause })

const SessionProvider = ({
  children,
  fallback = null,
  onError,
  autoReady = false,
  expand = false,
  disableVerticalSwipes = false,
}: SessionProviderProps): ReactNode => {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const onErrorRef = useRef(onError)
  const autoReadyRef = useRef(autoReady)
  const verticalSwipesDisabledRef = useRef(false)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    autoReadyRef.current = autoReady
  }, [autoReady])

  useEffect(() => {
    let active = true
    let current: Session | null = null

    const initialize = async () => {
      try {
        current = createSession()
        await current.start()
        if (!active) {
          return
        }

        if (autoReadyRef.current) {
          current.markReady()
        }
        setSession(current)
      } catch (error_) {
        current?.destroy()
        current = null
        if (!active) {
          return
        }

        const failure = toError(error_, "Failed to start the Telegram Mini App session")
        if (onErrorRef.current === undefined) {
          setError(failure)
        } else {
          onErrorRef.current(failure)
        }
      }
    }
    void initialize()

    return () => {
      active = false
      if (current !== null) {
        // Restore swipes first: after destroy the protocol cannot send this method.
        if (verticalSwipesDisabledRef.current && current.status.get() !== "closed") {
          current.features.swipeBehavior.actions.enableVertical()
        }
        verticalSwipesDisabledRef.current = false
        current.destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (session !== null && expand) {
      session.features.viewport.actions.expand()
    }
  }, [expand, session])

  useEffect(() => {
    if (session === null || !disableVerticalSwipes) {
      return undefined
    }

    const { swipeBehavior } = session.features
    swipeBehavior.actions.disableVertical()
    verticalSwipesDisabledRef.current = true
    return () => {
      if (session.status.get() !== "closed") {
        swipeBehavior.actions.enableVertical()
      }
      verticalSwipesDisabledRef.current = false
    }
  }, [disableVerticalSwipes, session])

  if (error !== null) {
    throw error
  }
  if (session === null) {
    return fallback
  }

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export { SessionProvider, type SessionProviderProps }
