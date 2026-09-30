import type { EventHub } from "./event-hub"
import type { TelegramEventName, TelegramEventPayloads } from "./event-schemas"
import type { PostEventArgs } from "./post-event"

import { createDisposer } from "./disposer"
import { postEvent } from "./post-event"

type RequestResult<E extends TelegramEventName> = {
  [K in E]: { event: K; payload: TelegramEventPayloads[K] }
}[E]

type RequestOptions<E extends TelegramEventName> = {
  method: PostEventArgs
  events: readonly E[]
  timeout?: number
}

type Request = <E extends TelegramEventName>(
  options: RequestOptions<E>,
) => Promise<RequestResult<E>>

type CreateRequestOptions = {
  hub: Pick<EventHub, "on">
  postEvent?: typeof postEvent
  signal?: AbortSignal
  defaultTimeout?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

// Users may take a long time on the native consent dialog.
const USER_CONFIRMATION_TIMEOUT_MS = 300_000

const createAbortError = (method: string): Error => {
  const error = new Error(`Request "${method}" was aborted`)
  error.name = "AbortError"
  return error
}

/**
 * Calls a Mini Apps method and waits for the first of the specified events
 * to be received from the Telegram client.
 */
const createRequest = (options: CreateRequestOptions): Request => {
  const { hub, postEvent: post = postEvent, signal, defaultTimeout = DEFAULT_TIMEOUT_MS } = options

  const request = async <E extends TelegramEventName>(
    requestOptions: RequestOptions<E>,
  ): Promise<RequestResult<E>> => {
    const { method: methodArgs, events, timeout = defaultTimeout } = requestOptions
    const [method] = methodArgs

    if (events.length === 0) {
      throw new Error(`Request "${method}" must wait for at least one event`)
    }
    if (!Number.isFinite(timeout) || timeout < 0) {
      throw new Error("Request timeout must be a non-negative finite number")
    }
    if (signal?.aborted === true) {
      throw createAbortError(method)
    }

    return new Promise<RequestResult<E>>((resolve, reject) => {
      const disposer = createDisposer()
      let isSettled = false

      const settle = (action: () => void): void => {
        if (isSettled) {
          return
        }
        isSettled = true
        disposer.dispose()
        action()
      }

      const timeoutId = setTimeout(() => {
        settle(() => {
          reject(
            new Error(`Request "${method}" timed out waiting for events: ${events.join(", ")}`),
          )
        })
      }, timeout)
      disposer.add(() => {
        clearTimeout(timeoutId)
      })

      const abortListener = (): void => {
        settle(() => {
          reject(createAbortError(method))
        })
      }
      signal?.addEventListener("abort", abortListener, { once: true })
      disposer.add(() => {
        signal?.removeEventListener("abort", abortListener)
      })

      for (const event of events) {
        disposer.add(
          hub.on(event, (payload) => {
            settle(() => {
              resolve({ event, payload } as RequestResult<E>)
            })
          }),
        )
      }

      if (signal?.aborted === true) {
        abortListener()
        return
      }

      try {
        post(...methodArgs)
      } catch (error) {
        settle(() => {
          reject(
            error instanceof Error
              ? error
              : new Error("Unable to post Telegram event", { cause: error }),
          )
        })
      }
    })
  }

  return request
}

export {
  createRequest,
  USER_CONFIRMATION_TIMEOUT_MS,
  type Request,
  type RequestOptions,
  type RequestResult,
}
