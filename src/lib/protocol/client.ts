/* oxlint-disable max-lines -- the request state machine and its gate share one protocol closure */
import { createDisposer } from "#lib/disposer"
import { isRecord } from "#lib/is-record"

import type {
  Capability,
  EventName,
  EventPayloads,
  Method,
  MethodArgs,
  MethodCorrelation,
  MethodEvents,
  MethodParams,
} from "./methods"
import type { ProtocolWindow, TelegramEventSink } from "./transport"

import { encodeMethod, parseEventPayload } from "./codec"
import { createAbortError, ProtocolTimeoutError, UnsupportedMethodError } from "./errors"
import {
  isEventName,
  methodDefinitions,
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
  /**
   * Aborts just this request and releases its method for the next call; the
   * protocol keeps working. A queued request can abort before its turn.
   */
  signal?: AbortSignal
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

type MethodWaiter = {
  /** Resolves the waiter's turn and hands it the release function. */
  grant: () => void
}

type MethodQueue = {
  /** Calls waiting for their turn, in call order, behind the active request. */
  waiters: MethodWaiter[]
}

/** Subscribes one listener to every signal and returns a single unsubscribe. */
const subscribeAbort = (signals: readonly AbortSignal[], listener: () => void): (() => void) => {
  const removers: (() => void)[] = []
  for (const abortSignal of signals) {
    // oxlint-disable-next-line react-doctor/rn-no-dimensions-get
    abortSignal.addEventListener("abort", listener, { once: true })
    removers.push(() => {
      abortSignal.removeEventListener("abort", listener)
    })
  }

  return () => {
    for (const remove of removers) {
      remove()
    }
  }
}

const readField = (value: unknown, field: string): unknown =>
  isRecord(value) ? value[field] : undefined

const matchesCorrelation = (
  correlation: MethodCorrelation,
  expected: unknown,
  payload: unknown,
): boolean => {
  const reply = readField(payload, correlation.reply)
  // A reply that omits the field cannot be attributed to another request.
  // A host that omits it on an optional reply still settles the only active call.
  if (reply === undefined) {
    return correlation.optionalReply === true
  }
  return reply === expected
}

const createProtocol = (options: CreateProtocolOptions): Protocol => {
  const { platform, version, signal, defaultTimeout = DEFAULT_TIMEOUT_MS } = options
  const browserWindow = options.window ?? getBrowserWindow()
  // Web K reports `web` in launch parameters; the host is the reliable signal.
  const capabilityPlatform = platform === "web" && isWebKWindow(browserWindow) ? "webk" : platform
  const transport = createTransport(browserWindow)
  const handlerSets = new Map<EventName, Set<(payload: unknown) => void>>()
  // One holding request per method key; later calls wait in FIFO order.
  const methodQueues = new Map<Method, MethodQueue>()
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

  const releaseMethodTurn = (method: Method): void => {
    const queue = methodQueues.get(method)
    if (queue === undefined) {
      return
    }
    const next = queue.waiters.shift()
    if (next === undefined) {
      methodQueues.delete(method)
      return
    }
    next.grant()
  }

  const holdMethodTurn = (method: Method): (() => void) => {
    let isReleased = false
    return () => {
      if (isReleased) {
        return
      }
      isReleased = true
      releaseMethodTurn(method)
    }
  }

  // A hand-built promise grants the method to the next call before this request resolves.
  // oxlint-disable-next-line typescript/promise-function-async
  const enqueueMethodWait = (
    method: Method,
    queue: MethodQueue,
    signals: readonly AbortSignal[],
  ): Promise<() => void> =>
    new Promise<() => void>((resolve, reject) => {
      let removeAbortListeners = noop
      const waiter: MethodWaiter = {
        grant: () => {
          removeAbortListeners()
          resolve(holdMethodTurn(method))
        },
      }
      const cancel = (): void => {
        removeAbortListeners()
        const index = queue.waiters.indexOf(waiter)
        if (index !== -1) {
          queue.waiters.splice(index, 1)
        }
        reject(createAbortError(method))
      }

      removeAbortListeners = subscribeAbort(signals, cancel)
      queue.waiters.push(waiter)
      if (signals.some((abortSignal) => abortSignal.aborted)) {
        cancel()
      }
    })

  /**
   * Takes the method's turn immediately for the first call, or queues the call
   * and resolves with its release function when its turn comes.
   */
  const acquireMethodTurn = (
    method: Method,
    signals: readonly AbortSignal[],
  ): (() => void) | Promise<() => void> => {
    const queue = methodQueues.get(method)
    if (queue === undefined) {
      methodQueues.set(method, { waiters: [] })
      return holdMethodTurn(method)
    }
    return enqueueMethodWait(method, queue, signals)
  }

  // The executor owns the whole request lifetime, so the promise is hand-built.
  // oxlint-disable-next-line typescript/promise-function-async
  const startRequest = <M extends Method>(
    requestOptions: RequestOptions<M>,
    signals: readonly AbortSignal[],
    releaseTurn: () => void,
  ): Promise<RequestResult<MethodEvents<M>>> => {
    const method = requestOptions.method[0]
    const events = requestOptions.events ?? methodTable[method].events
    const timeout = requestOptions.timeout ?? defaultTimeout
    const [requestMethod, requestParams] = requestOptions.method
    const correlation = methodDefinitions[method].correlate
    const correlationValue =
      correlation === undefined ? undefined : readField(requestParams, correlation.param)

    return new Promise<RequestResult<MethodEvents<M>>>((resolve, reject) => {
      const requestDisposer = createDisposer()
      let isSettled = false

      const settle = (action: () => void): void => {
        if (isSettled) {
          return
        }
        isSettled = true
        releaseTurn()
        requestDisposer.dispose()
        action()
      }

      // The timeout covers this request's own turn, not the wait behind another request.
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
      requestDisposer.add(subscribeAbort(signals, abortListener))

      try {
        for (const event of events) {
          requestDisposer.add(
            on(event, (payload) => {
              if (
                correlation !== undefined &&
                !matchesCorrelation(correlation, correlationValue, payload)
              ) {
                return
              }
              // The event/payload pair is correlated by the table at runtime.
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
              const result = { event, payload } as RequestResult<MethodEvents<M>>
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

    const turn = acquireMethodTurn(method, signals)
    if (typeof turn === "function") {
      return startRequest(requestOptions, signals, turn)
    }

    return startRequest(requestOptions, signals, await turn)
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
