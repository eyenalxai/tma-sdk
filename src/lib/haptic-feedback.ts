import type { TelegramMethodParams } from "./post-event"
import type { TelegramRuntime } from "./telegram-runtime"

import { postEventBestEffort } from "./post-event"
import { supports } from "./version"

type HapticFeedbackParams = TelegramMethodParams["web_app_trigger_haptic_feedback"]
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
  const isSupported = supports("web_app_trigger_haptic_feedback", runtime.version)

  const trigger = (params: HapticFeedbackParams) => {
    if (isSupported) {
      postEventBestEffort("web_app_trigger_haptic_feedback", params)
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
