import type { MainButtonParams } from "#lib/protocol/methods"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createStore } from "#lib/store"

import type { FeatureController } from "./controller"

type BottomButtonState = {
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  text: string
  color?: string
  textColor?: string
  hasShineEffect?: boolean
  iconCustomEmojiId?: string
}

type BottomButtonActions<State extends BottomButtonState> = {
  /** Merges the partial state and posts the whole button state to Telegram. */
  set: (partial: Partial<State>) => void
  onClick: (listener: () => void) => () => void
}

type BottomButtonConfig<State extends BottomButtonState> = {
  initial: State
  method: "web_app_setup_main_button" | "web_app_setup_secondary_button"
  event: "main_button_pressed" | "secondary_button_pressed"
  toParams: (state: State) => MainButtonParams
}

const visibleButtonParams = (state: BottomButtonState): MainButtonParams => {
  const params: MainButtonParams = {
    is_visible: true,
    is_active: state.isActive,
    is_progress_visible: state.isProgressVisible,
    text: state.text,
    has_shine_effect: state.hasShineEffect === true && state.isActive && !state.isProgressVisible,
  }
  if (state.color !== undefined) {
    params.color = state.color
  }
  if (state.textColor !== undefined) {
    params.text_color = state.textColor
  }
  if (state.iconCustomEmojiId !== undefined) {
    params.icon_custom_emoji_id = state.iconCustomEmojiId
  }
  return params
}

const createBottomButton = <State extends BottomButtonState>(
  runtime: TelegramRuntime,
  config: BottomButtonConfig<State>,
): FeatureController<State, BottomButtonActions<State>> => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke(config.method)
  const store = createStore<State>(config.initial)

  const post = (params: MainButtonParams): boolean => {
    if (!supported) {
      return false
    }
    return config.method === "web_app_setup_main_button"
      ? invokeBestEffort(protocol, "web_app_setup_main_button", params)
      : invokeBestEffort(protocol, "web_app_setup_secondary_button", params)
  }

  return {
    supported,
    state: store,
    actions: {
      set: (partial) => {
        if (!supported) {
          return
        }
        const next = { ...store.get(), ...partial }
        const params = next.isVisible ? config.toParams(next) : { is_visible: false }
        if (post(params)) {
          store.set(next)
        }
      },
      onClick: (listener) => protocol.on(config.event, listener),
    },
  }
}

export {
  createBottomButton,
  visibleButtonParams,
  type BottomButtonActions,
  type BottomButtonConfig,
  type BottomButtonState,
}
