import type { TelegramEventName, TelegramEventPayloads } from "./events"
import type { PostEventArgs } from "./post-event"

import { on } from "./events"
import { postEvent } from "./post-event"

type RequestResult<E extends TelegramEventName> = {
  [K in E]: { event: K; payload: TelegramEventPayloads[K] }
}[E]

type RequestOptions<E extends TelegramEventName> = {
  method: PostEventArgs
  events: readonly E[]
  timeout?: number
  signal?: AbortSignal
}

const createAbortError = (method: string): Error => {
  const error = new Error(`Request "${method}" was aborted`)
  error.name = "AbortError"
  return error
}

/**
 * Calls a Mini Apps method and waits for the first of the specified events
 * to be received from the Telegram client.
 */
const request = async <E extends TelegramEventName>(
  options: RequestOptions<E>,
): Promise<RequestResult<E>> => {
  const { method: methodArgs, events, signal, timeout } = options
  const [method] = methodArgs

  if (events.length === 0) {
    throw new Error(`Request "${method}" must wait for at least one event`)
  }
  if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0)) {
    throw new Error("Request timeout must be a non-negative finite number")
  }

  if (signal?.aborted === true) {
    throw createAbortError(method)
  }

  return new Promise((resolve, reject) => {
    const cleanupCallbacks: (() => void)[] = []
    const resources: {
      abortListener: (() => void) | null
      timeoutId: ReturnType<typeof setTimeout> | null
    } = { abortListener: null, timeoutId: null }

    const cleanup = () => {
      if (resources.timeoutId !== null) {
        clearTimeout(resources.timeoutId)
        resources.timeoutId = null
      }
      if (resources.abortListener !== null) {
        signal?.removeEventListener("abort", resources.abortListener)
        resources.abortListener = null
      }
      for (const callback of cleanupCallbacks.splice(0)) {
        callback()
      }
    }

    resources.abortListener = () => {
      cleanup()
      reject(createAbortError(method))
    }

    for (const event of events) {
      cleanupCallbacks.push(
        on(event, (payload) => {
          cleanup()
          resolve({ event, payload } as RequestResult<E>)
        }),
      )
    }
    if (timeout !== undefined) {
      resources.timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error(`Request "${method}" timed out waiting for events: ${events.join(", ")}`))
      }, timeout)
    }
    signal?.addEventListener("abort", resources.abortListener, { once: true })
    if (signal?.aborted === true) {
      resources.abortListener()
      return
    }

    try {
      postEvent(...methodArgs)
    } catch (error) {
      cleanup()
      reject(
        error instanceof Error
          ? error
          : new Error("Unable to post Telegram event", { cause: error }),
      )
    }
  })
}

export { request, type RequestResult }
