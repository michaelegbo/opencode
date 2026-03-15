import { MessageV2 } from "./message-v2"

export const done = (msg: MessageV2.Assistant, time = Date.now()) => {
  if (typeof msg.time.completed === "number") return msg
  msg.time.completed = time
  return msg
}
