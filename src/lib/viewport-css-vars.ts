import type { Store } from "./store"
import type { ViewportState } from "./viewport"

type ViewportCssVariableTarget = {
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">
}

const viewportCssVariables = (
  state: ViewportState,
): readonly (readonly [name: string, value: number])[] => [
  ["--tg-viewport-height", state.height],
  ["--tg-viewport-stable-height", state.stableHeight],
  ["--tg-safe-area-inset-top", state.safeAreaInsets.top],
  ["--tg-safe-area-inset-bottom", state.safeAreaInsets.bottom],
  ["--tg-safe-area-inset-left", state.safeAreaInsets.left],
  ["--tg-safe-area-inset-right", state.safeAreaInsets.right],
  ["--tg-content-safe-area-inset-top", state.contentSafeAreaInsets.top],
  ["--tg-content-safe-area-inset-bottom", state.contentSafeAreaInsets.bottom],
  ["--tg-content-safe-area-inset-left", state.contentSafeAreaInsets.left],
  ["--tg-content-safe-area-inset-right", state.contentSafeAreaInsets.right],
]

const bindViewportCssVariables = (
  store: Store<ViewportState>,
  target?: ViewportCssVariableTarget,
): (() => void) => {
  const cssVariableTarget = target ?? { style: document.documentElement.style }

  const update = (): void => {
    for (const [name, value] of viewportCssVariables(store.get())) {
      cssVariableTarget.style.setProperty(name, `${value}px`)
    }
  }

  update()
  const unsubscribe = store.subscribe(update)

  return () => {
    unsubscribe()
    for (const [name] of viewportCssVariables(store.get())) {
      cssVariableTarget.style.removeProperty(name)
    }
  }
}

export { bindViewportCssVariables, viewportCssVariables, type ViewportCssVariableTarget }
