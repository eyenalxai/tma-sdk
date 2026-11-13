import type { TelegramRuntime } from "#lib/telegram-runtime"

import type { BottomButtonActions, BottomButtonState } from "./bottom-button"
import type { FeatureController } from "./controller"

import { createBottomButton, visibleButtonParams } from "./bottom-button"

type SecondaryButtonPosition = "left" | "right" | "top" | "bottom"

type SecondaryButtonState = BottomButtonState & {
  position: SecondaryButtonPosition
}

type SecondaryButtonActions = BottomButtonActions<SecondaryButtonState>

type SecondaryButtonController = FeatureController<SecondaryButtonState, SecondaryButtonActions>

const initialSecondaryButtonState: SecondaryButtonState = {
  isVisible: false,
  isActive: true,
  isProgressVisible: false,
  text: "Cancel",
  position: "left",
  hasShineEffect: false,
}

const createSecondaryButton = (runtime: TelegramRuntime): SecondaryButtonController =>
  createBottomButton(runtime, {
    initial: initialSecondaryButtonState,
    method: "web_app_setup_secondary_button",
    event: "secondary_button_pressed",
    toParams: (state) => {
      return { ...visibleButtonParams(state), position: state.position }
    },
  })

export {
  createSecondaryButton,
  initialSecondaryButtonState,
  type SecondaryButtonActions,
  type SecondaryButtonController,
  type SecondaryButtonPosition,
  type SecondaryButtonState,
}
