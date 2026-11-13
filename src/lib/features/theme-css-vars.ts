import type { ReadonlyStore } from "#lib/store"

import type { ThemeState } from "./theme"

type ThemeCssVariableTarget = {
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">
}

const themeCssVariables = (
  state: ThemeState,
): readonly (readonly [name: string, value: string])[] => {
  const variables: (readonly [name: string, value: string])[] = []
  for (const [key, value] of Object.entries(state.themeParams)) {
    variables.push([`--tg-theme-${key.replaceAll("_", "-")}`, value])
  }
  if (state.colorScheme !== null) {
    variables.push(["--tg-color-scheme", state.colorScheme])
  }
  return variables
}

/**
 * Writes the Telegram theme variables to the document root, following
 * `theme_changed` and removing the properties on unbinding.
 */
const bindThemeCssVariables = (
  store: ReadonlyStore<ThemeState>,
  target?: ThemeCssVariableTarget,
): (() => void) => {
  const cssVariableTarget = target ?? { style: document.documentElement.style }
  const written = new Set<string>()

  const update = (): void => {
    const variables = themeCssVariables(store.get())
    const names = new Set(variables.map(([name]) => name))
    for (const name of written) {
      if (!names.has(name)) {
        cssVariableTarget.style.removeProperty(name)
        written.delete(name)
      }
    }
    for (const [name, value] of variables) {
      cssVariableTarget.style.setProperty(name, value)
      written.add(name)
    }
  }

  update()
  const unsubscribe = store.subscribe(update)

  return () => {
    unsubscribe()
    for (const name of written) {
      cssVariableTarget.style.removeProperty(name)
    }
    written.clear()
  }
}

export { bindThemeCssVariables, themeCssVariables, type ThemeCssVariableTarget }
