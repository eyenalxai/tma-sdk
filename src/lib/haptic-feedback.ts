import type { HapticFeedbackParams } from "#lib/protocol/methods"

import { invokeBestEffort } from "#lib/protocol/client"

import type { TelegramRuntime } from "./telegram-runtime"

type ImpactHapticFeedbackStyle = Extract<HapticFeedbackParams, { type: "impact" }>["impact_style"]
type NotificationHapticFeedbackType = Extract<
  HapticFeedbackParams,
  { type: "notification" }
>["notification_type"]

type HapticFeedback = {
  isSupported: boolean
  impactOccurred: (style: ImpactHapticFeedbackStyle) => void
  notificationOccurred: (type: NotificationHapticFeedbackType) => void
  selectionChanged: () => void
}

const createHapticFeedback = (runtime: TelegramRuntime): HapticFeedback => {
  const { protocol } = runtime
  const isSupported = protocol.canInvoke("web_app_trigger_haptic_feedback")

  const trigger = (params: HapticFeedbackParams) => {
    if (isSupported) {
      invokeBestEffort(protocol, "web_app_trigger_haptic_feedback", params)
    }
  }

  return {
    isSupported,
    impactOccurred: (style) => {
      trigger({ type: "impact", impact_style: style })
    },
    notificationOccurred: (type) => {
      trigger({ type: "notification", notification_type: type })
    },
    selectionChanged: () => {
      trigger({ type: "selection_change" })
    },
  }
}

export {
  createHapticFeedback,
  type HapticFeedback,
  type ImpactHapticFeedbackStyle,
  type NotificationHapticFeedbackType,
}
