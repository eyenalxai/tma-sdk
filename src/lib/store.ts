type Store<T extends object> = {
  get: () => T
  set: (value: T) => void
  update: (partial: Partial<T>) => void
  subscribe: (listener: () => void) => () => void
}

const createStore = <T extends object>(initial: T): Store<T> => {
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
      let hasChanges = false
      for (const key in partial) {
        if (Object.hasOwn(partial, key) && !Object.is(value[key], partial[key])) {
          hasChanges = true
          break
        }
      }
      if (!hasChanges) {
        return
      }
      value = { ...value, ...partial }
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
