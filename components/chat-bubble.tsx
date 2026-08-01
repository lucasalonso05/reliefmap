import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import type { ChatMessage } from "@/lib/types"

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center px-4 py-1">
        <div className="flex max-w-[85%] items-start gap-2 rounded-lg bg-bubble-system px-3 py-2 text-xs text-bubble-system-foreground shadow-sm">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="leading-relaxed text-pretty">{message.content}</span>
        </div>
      </div>
    )
  }

  const isCitizen = message.role === "citizen"

  return (
    <div
      className={cn(
        "flex w-full px-3",
        isCitizen ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          isCitizen
            ? "rounded-br-md bg-bubble-out text-bubble-out-foreground"
            : "rounded-bl-md bg-bubble-in text-bubble-in-foreground",
        )}
      >
        {!isCitizen && (
          <p className="mb-0.5 text-xs font-semibold text-primary">
            911 Emergency
          </p>
        )}
        <p className="whitespace-pre-wrap leading-relaxed text-pretty">
          {message.content}
        </p>
        <span
          className={cn(
            "mt-1 block text-right text-[10px]",
            isCitizen
              ? "text-bubble-out-foreground/60"
              : "text-bubble-in-foreground/50",
          )}
        >
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}
