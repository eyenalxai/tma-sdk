import type { TelegramRuntime } from "#lib/telegram-runtime"

import { createDisposer } from "#lib/disposer"

import type { ProtocolWindow } from "./transport"

import { createProtocol } from "./client"

type NativePost = { eventType: string; eventData: string }

const createNativeWindow = () => {
  const posts: NativePost[] = []
  const browserWindow: ProtocolWindow = {
    TelegramWebviewProxy: {
      postEvent: (eventType: string, eventData: string) => {
        posts.push({ eventType, eventData })
      },
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  browserWindow.self = browserWindow
  browserWindow.top = browserWindow
  browserWindow.parent = browserWindow

  const emit = (eventType: string, eventData?: unknown): void => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const receive = browserWindow.TelegramGameProxy_receiveEvent as (
      eventType: string,
      eventData?: unknown,
    ) => void
    receive(eventType, eventData)
  }

  return { browserWindow, posts, emit }
}

const createTestRuntime = (platform: string, version: string) => {
  const { browserWindow, posts, emit } = createNativeWindow()
  const disposer = createDisposer()
  const protocol = createProtocol({ platform, version, window: browserWindow })
  disposer.add(() => {
    protocol.destroy()
  })
  const runtime: TelegramRuntime = { protocol, disposer }

  return {
    runtime,
    posts,
    emit,
    dispose: () => {
      disposer.dispose()
    },
  }
}

export { createNativeWindow, createTestRuntime, type NativePost }
