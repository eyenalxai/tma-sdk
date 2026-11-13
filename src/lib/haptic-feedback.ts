import type { FeatureController } from "#lib/features/controller"
import type { HapticFeedbackParams } from "#lib/protocol/methods"
import type { TelegramRuntime } from "#lib/telegram-runtime"

import { invokeBestEffort } from "#lib/protocol/client"
import { createConstantStore } from "#lib/store"

type ImpactHapticFeedbackStyle = Extract<HapticFeedbackParams, { type: "impact" }>["impact_style"]
type NotificationHapticFeedbackType = Extract<
  HapticFeedbackParams,
  { type: "notification" }
>["notification_type"]

type HapticsActions = {
  impact: (style: ImpactHapticFeedbackStyle) => void
  notification: (type: NotificationHapticFeedbackType) => void
  selection: () => void
}

type HapticsController = FeatureController<null, HapticsActions>

const createHaptics = (runtime: TelegramRuntime): HapticsController => {
  const { protocol } = runtime
  const supported = protocol.mayInvoke("web_app_trigger_haptic_feedback")

  const trigger = (params: HapticFeedbackParams): void => {
    if (supported) {
      invokeBestEffort(protocol, "web_app_trigger_haptic_feedback", params)
    }
  }

  return {
    supported,
    state: createConstantStore(null),
    actions: {
      impact: (style) => {
        trigger({ type: "impact", impact_style: style })
      },
      notification: (type) => {
        trigger({ type: "notification", notification_type: type })
      },
      selection: () => {
        trigger({ type: "selection_change" })
      },
    },
  }
}

export {
  createHaptics,
  type HapticsActions,
  type HapticsController,
  type ImpactHapticFeedbackStyle,
  type NotificationHapticFeedbackType,
}
