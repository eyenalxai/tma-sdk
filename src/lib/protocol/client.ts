/* oxlint-disable max-lines -- the request state machine and its gate share one protocol closure */
import { createDisposer } from "#lib/disposer"

import type {
  Capability,
  EventName,
  EventPayloads,
  Method,
  MethodArgs,
  MethodEvents,
  MethodParams,
} from "./methods"
import type { ProtocolWindow, TelegramEventSink } from "./transport"

import { encodeMethod, parseEventPayload } from "./codec"
import { createAbortError, ProtocolTimeoutError, UnsupportedMethodError } from "./errors"
import {
  isEventName,
  methodTable,
  supports as getCapability,
  supportsParam as getParamCapability,
} from "./methods"
import { createTransport, getBrowserWindow, installInboundBridge, isWebKWindow } from "./transport"

const DEFAULT_TIMEOUT_MS = 10_000

// Users may take a long time on the native consent dialog.
const USER_CONFIRMATION_TIMEOUT_MS = 300_000

type RequestResult<E extends EventName> = {
  [K in E]: { event: K; payload: EventPayloads[K] }
}[E]

type RequestOptions<M extends Method> = {
  method: MethodArgs<M>
  events?: readonly MethodEvents<M>[]
  timeout?: number
  /** Aborts just this request; the protocol keeps working. */
  signal?: AbortSignal
  /** Return false for a reply that belongs to another request; the call keeps waiting. */
  correlate?: (result: RequestResult<MethodEvents<M>>) => boolean
}

type Request = <M extends Method>(
  options: RequestOptions<M>,
) => Promise<RequestResult<MethodEvents<M>>>

type Invoke = <M extends Method>(method: M, params?: MethodParams<M>) => void

type On = <E extends EventName>(
  event: E,
  handler: (payload: EventPayloads[E]) => void,
) => () => void

type Protocol = {
  invoke: Invoke
  request: Request
  on: On
  supports: (method: Method) => Capability
  mayInvoke: (method: Method) => boolean
  supportsParam: (method: Method, param: string) => boolean
  readonly isFramed: boolean
  destroy: () => void
}

type CreateProtocolOptions = {
  platform: string
  version: string
  window?: ProtocolWindow
  signal?: AbortSignal
  defaultTimeout?: number
}

const noop = (): void => undefined

const waitForSettled = async (
  settled: Promise<void>,
  method: Method,
  signals: readonly AbortSignal[],
): Promise<void> => {
  if (signals.length === 0) {
    await settled
    return
  }

  const removeAbortListeners: (() => void)[] = []
  const abortPromise = new Promise<never>((_resolve, reject) => {
    const abortListener = (): void => {
      reject(createAbortError(method))
    }
    for (const abortSignal of signals) {
      // oxlint-disable-next-line react-doctor/rn-no-dimensions-get
      abortSignal.addEventListener("abort", abortListener, { once: true })
      removeAbortListeners.push(() => {
        abortSignal.removeEventListener("abort", abortListener)
      })
    }
  })

  try {
    await Promise.race([settled, abortPromise])
  } finally {
    for (const removeAbortListener of removeAbortListeners) {
      removeAbortListener()
    }
  }
}

const createProtocol = (options: CreateProtocolOptions): Protocol => {
  const { platform, version, signal, defaultTimeout = DEFAULT_TIMEOUT_MS } = options
  const browserWindow = options.window ?? getBrowserWindow()
  // Web K reports `web` in launch parameters; the host is the reliable signal.
  const capabilityPlatform = platform === "web" && isWebKWindow(browserWindow) ? "webk" : platform
  const transport = createTransport(browserWindow)
  const handlerSets = new Map<EventName, Set<(payload: unknown) => void>>()
  // One in-flight request per method key; the value settles when the request does.
  const pendingMethods = new Map<Method, Promise<void>>()
  const disposer = createDisposer()
  let isDestroyed = false
  const getCapabilityFor = (method: Method): Capability =>
    getCapability(method, capabilityPlatform, version)

  const receive: TelegramEventSink = (eventType, eventData) => {
    if (!isEventName(eventType)) {
      return
    }
    const handlers = handlerSets.get(eventType)
    if (handlers === undefined || handlers.size === 0) {
      return
    }

    let payload: EventPayloads[EventName] | null = null
    try {
      payload = parseEventPayload(eventType, eventData, browserWindow)
    } catch (error) {
      console.error(`[Telegram] Failed to parse "${eventType}" event payload`, eventData, error)
      return
    }

    for (const handler of handlers) {
      handler(payload)
    }
  }

  disposer.add(installInboundBridge(browserWindow, receive, transport.targetOrigin))

  const invoke = <M extends Method>(method: M, params?: MethodParams<M>): void => {
    if (isDestroyed) {
      throw new Error("Cannot invoke a method on a destroyed protocol")
    }
    const capability = getCapabilityFor(method)
    if (capability === "unsupported") {
      throw new UnsupportedMethodError({ method, platform: capabilityPlatform, version })
    }
    transport.send(encodeMethod(method, params))
  }

  const on: On = (event, handler) => {
    if (isDestroyed) {
      throw new Error("Cannot subscribe to a destroyed protocol")
    }

    let handlers = handlerSets.get(event)
    if (handlers === undefined) {
      handlers = new Set()
      handlerSets.set(event, handlers)
    }
    // The map stores handlers under their event key; dispatch is type-checked at the call site.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const wrapped = handler as (payload: unknown) => void
    handlers.add(wrapped)

    return () => {
      handlers.delete(wrapped)
    }
  }

  const acquireMethod = (method: Method): (() => void) => {
    let release = noop
    const settled = new Promise<void>((resolve) => {
      release = resolve
    })
    pendingMethods.set(method, settled)

    return () => {
      if (pendingMethods.get(method) !== settled) {
        return
      }
      pendingMethods.delete(method)
      release()
    }
  }

  const waitForMethodTurn = async (
    method: Method,
    signals: readonly AbortSignal[],
  ): Promise<() => void> => {
    for (;;) {
      const previous = pendingMethods.get(method)
      if (previous === undefined) {
        return acquireMethod(method)
      }
      // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
      await waitForSettled(previous, method, signals)
    }
  }

  const request = async <M extends Method>(
    requestOptions: RequestOptions<M>,
  ): Promise<RequestResult<MethodEvents<M>>> => {
    const method = requestOptions.method[0]
    const events = requestOptions.events ?? methodTable[method].events
    const timeout = requestOptions.timeout ?? defaultTimeout
    const signals = [signal, requestOptions.signal].filter(
      (candidate): candidate is AbortSignal => candidate !== undefined,
    )

    if (events.length === 0) {
      throw new Error(`Request "${method}" must wait for at least one event`)
    }
    if (!Number.isFinite(timeout) || timeout < 0) {
      throw new Error("Request timeout must be a non-negative finite number")
    }
    if (signals.some((abortSignal) => abortSignal.aborted)) {
      throw createAbortError(method)
    }

    const start = async (releaseMethod: () => void): Promise<RequestResult<MethodEvents<M>>> =>
      new Promise<RequestResult<MethodEvents<M>>>((resolve, reject) => {
        const requestDisposer = createDisposer()
        let isSettled = false

        const settle = (action: () => void): void => {
          if (isSettled) {
            return
          }
          isSettled = true
          releaseMethod()
          requestDisposer.dispose()
          action()
        }

        const timeoutId = setTimeout(() => {
          settle(() => {
            reject(
              new ProtocolTimeoutError({
                method,
                platform: capabilityPlatform,
                version,
                events,
                timeout,
              }),
            )
          })
        }, timeout)
        requestDisposer.add(() => {
          clearTimeout(timeoutId)
        })

        const abortListener = (): void => {
          settle(() => {
            reject(createAbortError(method))
          })
        }
        for (const abortSignal of signals) {
          // oxlint-disable-next-line react-doctor/rn-no-dimensions-get
          abortSignal.addEventListener("abort", abortListener, { once: true })
          requestDisposer.add(() => {
            abortSignal.removeEventListener("abort", abortListener)
          })
        }

        try {
          for (const event of events) {
            requestDisposer.add(
              on(event, (payload) => {
                // The event/payload pair is correlated by the table at runtime.
                // oxlint-disable-next-line typescript/no-unsafe-type-assertion
                const result = { event, payload } as RequestResult<MethodEvents<M>>
                if (requestOptions.correlate !== undefined && !requestOptions.correlate(result)) {
                  return
                }
                settle(() => {
                  resolve(result)
                })
              }),
            )
          }
        } catch (error) {
          settle(() => {
            reject(
              error instanceof Error
                ? error
                : new Error("Unable to subscribe to Telegram events", { cause: error }),
            )
          })
          return
        }

        if (signals.some((abortSignal) => abortSignal.aborted)) {
          abortListener()
          return
        }

        try {
          const [requestMethod, requestParams] = requestOptions.method
          invoke(requestMethod, requestParams)
        } catch (error) {
          settle(() => {
            reject(
              error instanceof Error
                ? error
                : new Error("Unable to send Telegram event", { cause: error }),
            )
          })
        }
      })

    if (pendingMethods.has(method)) {
      return start(await waitForMethodTurn(method, signals))
    }

    return start(acquireMethod(method))
  }

  return {
    invoke,
    request,
    on,
    supports: getCapabilityFor,
    mayInvoke: (method) => getCapabilityFor(method) !== "unsupported",
    supportsParam: (method, param) => getParamCapability(method, param, version),
    isFramed: transport.isFramed,
    destroy: () => {
      if (isDestroyed) {
        return
      }
      isDestroyed = true
      disposer.dispose()
      for (const handlers of handlerSets.values()) {
        handlers.clear()
      }
      handlerSets.clear()
    },
  }
}

const invokeBestEffort = <M extends Method>(
  protocol: Protocol,
  ...args: MethodArgs<M>
): boolean => {
  try {
    const [method, params] = args
    if (params === undefined) {
      protocol.invoke(method)
    } else {
      protocol.invoke(method, params)
    }
    return true
  } catch (error) {
    console.warn(`[Telegram] Failed to invoke "${args[0]}"`, error)
    return false
  }
}

export {
  createProtocol,
  invokeBestEffort,
  USER_CONFIRMATION_TIMEOUT_MS,
  ProtocolTimeoutError,
  UnsupportedMethodError,
  type Protocol,
  type RequestOptions,
  type RequestResult,
}
