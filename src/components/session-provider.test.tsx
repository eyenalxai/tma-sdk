import type { ReactElement } from "react"
import type { Root } from "react-dom/client"

import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { act, useEffect } from "react"

import type { Session } from "#lib/session"

import { useSession } from "#hooks/use-session"

import { SessionProvider } from "./session-provider"

type NativePost = { eventType: string; eventData: string }

type CreateRoot = (container: Element | DocumentFragment) => Root

const posts: NativePost[] = []
const roots: Root[] = []
const captured: { session: Session | null } = { session: null }
const errors: Error[] = []
let createRoot: CreateRoot | null = null

const loading = <div>loading</div>
const content = <div>content</div>
const offline = <div>offline</div>

const CaptureSession = ({ onSession }: { onSession: (session: Session) => void }): ReactElement => {
  const session = useSession()
  useEffect(() => {
    onSession(session)
  }, [onSession, session])
  return content
}

const capture = (session: Session): void => {
  captured.session = session
}

const captureSession = <CaptureSession onSession={capture} />

const onError = (error: Error): void => {
  errors.push(error)
}

const actAsync = async (callback: () => void): Promise<void> => {
  await act(async () => {
    await Promise.resolve()
    callback()
  })
}

const setLaunchUrl = (search: string): void => {
  window.history.replaceState({}, "", `/${search}`)
}

const launchWithoutInitData = (platform: string): string =>
  `?tgWebAppPlatform=${platform}&tgWebAppVersion=9.6`

const render = async (element: ReactElement): Promise<HTMLElement> => {
  if (createRoot === null) {
    throw new Error("React DOM is not initialized")
  }

  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await actAsync(() => {
    root.render(element)
  })
  return container
}

const unmountAll = async (): Promise<void> => {
  await actAsync(() => {
    for (const root of roots.splice(0)) {
      root.unmount()
    }
  })
}

const emit = (eventType: string, eventData?: unknown): void => {
  const receive: unknown = Reflect.get(window, "TelegramGameProxy_receiveEvent")
  if (typeof receive === "function") {
    Reflect.apply(receive, window, [eventType, eventData])
  }
}

const emitInAct = async (eventType: string, eventData?: unknown): Promise<void> => {
  await actAsync(() => {
    emit(eventType, eventData)
  })
}

const postedEvents = (): string[] => posts.map((post) => post.eventType)

const swipeStates = (): boolean[] =>
  posts
    .filter((post) => post.eventType === "web_app_setup_swipe_behavior")
    .map((post) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const payload = JSON.parse(post.eventData) as { allow_vertical_swipe: boolean }
      return payload.allow_vertical_swipe
    })

let actEnvironmentDescriptor: PropertyDescriptor | undefined = undefined

beforeAll(async () => {
  actEnvironmentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT")
  GlobalRegistrator.register({ url: "https://app.example/" })
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true)
  // Registering globals must happen before React DOM reads the document.
  const reactDom = await import("react-dom/client")
  createRoot = reactDom.createRoot
})

afterAll(async () => {
  await GlobalRegistrator.unregister()
  if (actEnvironmentDescriptor === undefined) {
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT")
  } else {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", actEnvironmentDescriptor)
  }
})

beforeEach(() => {
  posts.length = 0
  errors.length = 0
  captured.session = null
  window.sessionStorage.clear()
  Object.assign(window, {
    TelegramWebviewProxy: {
      postEvent: (eventType: string, eventData: string) => {
        posts.push({ eventType, eventData })
      },
    },
  })
  setLaunchUrl(launchWithoutInitData("web"))
})

afterEach(async () => {
  await unmountAll()
})

describe("SessionProvider", () => {
  it("renders the fallback until the session starts", async () => {
    setLaunchUrl(launchWithoutInitData("ios"))

    const container = await render(<SessionProvider fallback={loading}>{content}</SessionProvider>)

    expect(container.textContent).toBe("loading")

    await emitInAct("viewport_changed", { height: 640, is_state_stable: true, is_expanded: true })

    expect(container.textContent).toBe("content")
  })

  it("leaves readiness to the app by default", async () => {
    const container = await render(
      <SessionProvider fallback={loading}>{captureSession}</SessionProvider>,
    )

    expect(container.textContent).toBe("content")
    expect(postedEvents()).not.toContain("web_app_ready")
    const session = captured.session
    expect(session?.status.get()).toBe("mounted")

    await actAsync(() => {
      session?.markReady()
    })

    expect(postedEvents()).toContain("web_app_ready")
    expect(session?.status.get()).toBe("ready")
  })

  it("marks the session ready when autoReady is true", async () => {
    const container = await render(
      <SessionProvider autoReady fallback={loading}>
        {captureSession}
      </SessionProvider>,
    )

    expect(container.textContent).toBe("content")
    expect(postedEvents()).toContain("web_app_ready")
    expect(captured.session?.status.get()).toBe("ready")
  })

  it("does not change native behavior by default", async () => {
    setLaunchUrl(launchWithoutInitData("ios"))

    await render(<SessionProvider fallback={loading}>{content}</SessionProvider>)
    await emitInAct("viewport_changed", { height: 640, is_state_stable: true, is_expanded: true })

    expect(postedEvents()).not.toContain("web_app_expand")
    expect(postedEvents()).not.toContain("web_app_setup_swipe_behavior")
  })

  it("applies expand and disableVerticalSwipes when asked", async () => {
    setLaunchUrl(launchWithoutInitData("ios"))

    await render(
      <SessionProvider expand disableVerticalSwipes fallback={loading}>
        {content}
      </SessionProvider>,
    )
    await emitInAct("viewport_changed", { height: 640, is_state_stable: true, is_expanded: true })

    expect(postedEvents()).toContain("web_app_expand")
    expect(postedEvents()).toContain("web_app_setup_swipe_behavior")
  })

  it("restores vertical swipes before closing the session on unmount", async () => {
    setLaunchUrl(launchWithoutInitData("ios"))

    await render(
      <SessionProvider disableVerticalSwipes fallback={loading}>
        {content}
      </SessionProvider>,
    )
    await emitInAct("viewport_changed", { height: 640, is_state_stable: true, is_expanded: true })

    expect(swipeStates()).toEqual([false])

    await unmountAll()

    expect(swipeStates()).toEqual([false, true])
  })

  it("binds the theme CSS variables when the theme changes", async () => {
    setLaunchUrl(launchWithoutInitData("ios"))

    await render(<SessionProvider fallback={loading}>{content}</SessionProvider>)
    await emitInAct("viewport_changed", { height: 640, is_state_stable: true, is_expanded: true })
    await emitInAct("theme_changed", {
      theme_params: { bg_color: "#ffffff" },
      color_scheme: "light",
    })

    expect(document.documentElement.style.getPropertyValue("--tg-theme-bg-color")).toBe("#ffffff")
    expect(document.documentElement.style.getPropertyValue("--tg-color-scheme")).toBe("light")
  })

  it("reports initialization failures through onError and keeps the fallback", async () => {
    setLaunchUrl("")

    const container = await render(
      <SessionProvider fallback={offline} onError={onError}>
        {content}
      </SessionProvider>,
    )

    expect(container.textContent).toBe("offline")
    expect(errors).toHaveLength(1)
    expect(errors[0]?.message).toContain("launch parameters")
  })
})
