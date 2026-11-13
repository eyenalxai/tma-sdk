type Store<T> = {
  get: () => T
  set: (value: T) => void
  update: (partial: Partial<T>) => void
  subscribe: (listener: () => void) => () => void
}

const createStore = <T>(initial: T): Store<T> => {
  let value = initial
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    get: () => value,
    set: (next) => {
      if (Object.is(value, next)) {
        return
      }
      value = next
      notify()
    },
    update: (partial) => {
      if (typeof value !== "object" || value === null) {
        return
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const current = value as Record<string, unknown>
      const patch = partial as Record<string, unknown>
      let hasChanges = false
      for (const key in patch) {
        if (Object.hasOwn(patch, key) && !Object.is(current[key], patch[key])) {
          hasChanges = true
          break
        }
      }
      if (!hasChanges) {
        return
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      value = { ...current, ...patch } as T
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export { createStore, type Store }
