import type { EventName, Method } from "./methods"

type ProtocolErrorOptions = {
  method: Method
  platform: string
  version: string
}

class UnsupportedMethodError extends Error {
  readonly method: Method
  readonly platform: string
  readonly version: string

  constructor(options: ProtocolErrorOptions) {
    super(`Method "${options.method}" is not supported on ${options.platform} ${options.version}`)
    this.name = "UnsupportedMethodError"
    this.method = options.method
    this.platform = options.platform
    this.version = options.version
  }
}

type ProtocolTimeoutErrorOptions = ProtocolErrorOptions & {
  events: readonly EventName[]
  timeout: number
}

class ProtocolTimeoutError extends Error {
  readonly method: Method
  readonly platform: string
  readonly version: string
  readonly events: readonly EventName[]
  readonly timeout: number

  constructor(options: ProtocolTimeoutErrorOptions) {
    super(
      `Request "${options.method}" timed out after ${options.timeout}ms on ` +
        `${options.platform} ${options.version} waiting for events: ${options.events.join(", ")}`,
    )
    this.name = "ProtocolTimeoutError"
    this.method = options.method
    this.platform = options.platform
    this.version = options.version
    this.events = options.events
    this.timeout = options.timeout
  }
}

const createAbortError = (method: Method): Error => {
  const error = new Error(`Request "${method}" was aborted`)
  error.name = "AbortError"
  return error
}

export { createAbortError, ProtocolTimeoutError, UnsupportedMethodError, type ProtocolErrorOptions }
