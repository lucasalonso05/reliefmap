"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Send, Siren, RotateCcw, MapPin, CheckCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatBubble } from "@/components/chat-bubble"
import { DispatchConsole } from "@/components/dispatch-console"
import {
  EMPTY_SLOTS,
  type ChatMessage,
  type EmergencyCategory,
  type IntakePhase,
  type IntakeEvent,
  type IntakeResult,
  type Slots,
} from "@/lib/types"

// Demo-compressed timers (real protocol: check-in every 3-4 min, silence 2 min).
const CHECKIN_INTERVAL = 30_000
const SILENCE_TIMEOUT = 15_000

const INITIAL_MESSAGE = `🚨 911 EMERGENCY: We are processing your call. Stay calm, help is on the way.

Please reply to this message with the following information (you can send it all together, in your own words):

DNI / NAME: Your identification.
LOCATION: Exact address, cross street, or reference point (e.g., in front of the plaza).
WHAT'S HAPPENING?: Briefly describe the emergency.
PEOPLE INVOLVED: How many injured or involved?`

const QUICK_SCENARIOS: { label: string; text: string }[] = [
  {
    label: "Full report",
    text: "Soy Juan Pérez, DNI 30456789. Estoy en Av. Corrientes 1234, frente a la plaza. Hay un incendio en el edificio, somos 3 personas atrapadas.",
  },
  {
    label: "Medical, no location",
    text: "My father collapsed and isn't breathing! Please help, I don't know CPR.",
  },
  {
    label: "Robbery in progress",
    text: "There's a robbery happening right now at 5th and Main, they have a gun.",
  },
]

let idCounter = 0
function newId() {
  idCounter += 1
  return `msg-${Date.now()}-${idCounter}`
}

function makeMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: newId(), role, content, createdAt: Date.now() }
}

export function EmergencyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage("agent", INITIAL_MESSAGE),
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)

  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS)
  const [category, setCategory] = useState<EmergencyCategory>("unknown")
  const [dispatched, setDispatched] = useState(false)
  const [phase, setPhase] = useState<IntakePhase>(1)
  const [etaMinutes, setEtaMinutes] = useState(8)
  const [escalate, setEscalate] = useState(false)
  const [centralLog, setCentralLog] = useState<string[]>([])
  const [closed, setClosed] = useState(false)
  const [autoMonitor, setAutoMonitor] = useState(true)

  const messagesRef = useRef<ChatMessage[]>(messages)
  const checkinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dispatchedRef = useRef(false)
  const closedRef = useRef(false)
  const autoMonitorRef = useRef(true)
  const etaRef = useRef(8)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  useEffect(() => {
    dispatchedRef.current = dispatched
  }, [dispatched])
  useEffect(() => {
    closedRef.current = closed
  }, [closed])
  useEffect(() => {
    autoMonitorRef.current = autoMonitor
  }, [autoMonitor])
  useEffect(() => {
    etaRef.current = etaMinutes
  }, [etaMinutes])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, typing])

  const clearTimers = useCallback(() => {
    if (checkinTimer.current) clearTimeout(checkinTimer.current)
    if (silenceTimer.current) clearTimeout(silenceTimer.current)
    checkinTimer.current = null
    silenceTimer.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const applyResult = useCallback(
    (result: IntakeResult) => {
      setSlots(result.slots)
      setCategory(result.category)
      setDispatched(result.dispatched)
      setPhase(result.phase)
      setEtaMinutes(result.etaMinutes)
      setEscalate(result.escalate)
      if (result.reply && result.reply.trim().length > 0) {
        setMessages((prev) => [...prev, makeMessage("agent", result.reply)])
      }
      if (result.centralNote && result.centralNote.trim().length > 0) {
        setCentralLog((prev) => [...prev, result.centralNote as string])
        setMessages((prev) => [
          ...prev,
          makeMessage("system", `Reported to central: ${result.centralNote}`),
        ])
      }
    },
    [],
  )

  const callIntake = useCallback(
    async (event: IntakeEvent): Promise<IntakeResult | null> => {
      setTyping(true)
      try {
        const res = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesRef.current,
            event,
            etaMinutes: etaRef.current,
          }),
        })
        if (!res.ok) throw new Error("Request failed")
        const data = (await res.json()) as IntakeResult
        applyResult(data)
        return data
      } catch (err) {
        console.log("[v0] callIntake error:", (err as Error).message)
        setMessages((prev) => [
          ...prev,
          makeMessage(
            "system",
            "Connection issue with the intake agent. Please try again.",
          ),
        ])
        return null
      } finally {
        setTyping(false)
      }
    },
    [applyResult],
  )

  const scheduleSilence = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current)
    silenceTimer.current = setTimeout(async () => {
      if (closedRef.current || !autoMonitorRef.current) return
      // Reporter did not respond to the check-in: escalate, send nothing to user.
      await callIntake("silence")
      // Per protocol: do not send a second check-in. Cycle stops here.
    }, SILENCE_TIMEOUT)
  }, [callIntake])

  const scheduleCheckin = useCallback(() => {
    if (checkinTimer.current) clearTimeout(checkinTimer.current)
    checkinTimer.current = setTimeout(async () => {
      if (closedRef.current || !autoMonitorRef.current || !dispatchedRef.current)
        return
      await callIntake("checkin")
      scheduleSilence()
    }, CHECKIN_INTERVAL)
  }, [callIntake, scheduleSilence])

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading || closed) return
      // Citizen responded -> cancel any pending silence escalation.
      clearTimers()
      setInput("")
      setLoading(true)
      const citizenMsg = makeMessage("citizen", trimmed)
      setMessages((prev) => [...prev, citizenMsg])
      // Ensure ref is fresh before the request.
      messagesRef.current = [...messagesRef.current, citizenMsg]
      const result = await callIntake("citizen_message")
      setLoading(false)
      if (result && result.dispatched && autoMonitorRef.current) {
        scheduleCheckin()
      }
    },
    [loading, closed, clearTimers, callIntake, scheduleCheckin],
  )

  const handleArrival = useCallback(async () => {
    if (closed) return
    clearTimers()
    await callIntake("arrival")
    setClosed(true)
  }, [closed, clearTimers, callIntake])

  const handleReset = useCallback(() => {
    clearTimers()
    const first = makeMessage("agent", INITIAL_MESSAGE)
    setMessages([first])
    messagesRef.current = [first]
    setInput("")
    setLoading(false)
    setTyping(false)
    setSlots(EMPTY_SLOTS)
    setCategory("unknown")
    setDispatched(false)
    setPhase(1)
    setEtaMinutes(8)
    setEscalate(false)
    setCentralLog([])
    setClosed(false)
  }, [clearTimers])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      handleSend(input)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Phone / chat */}
      <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary-foreground/15">
            <Siren className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">911 Emergency Response</p>
            <p className="flex items-center gap-1 text-xs text-primary-foreground/80">
              <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              {typing ? "typing…" : "online · secure line"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-primary-foreground/25"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            New call
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-2 overflow-y-auto bg-chat-bg py-3"
        >
          {messages.map((m) => (
            <ChatBubble key={m.id} message={m} />
          ))}
          {typing && (
            <div className="flex justify-start px-3">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-bubble-in px-4 py-3 shadow-sm">
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" />
              </div>
            </div>
          )}
        </div>

        {/* Quick scenarios */}
        {!closed && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-background px-3 pt-2">
            {QUICK_SCENARIOS.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={loading}
                onClick={() => handleSend(s.text)}
                className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border bg-background p-3">
          {closed ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
              <CheckCheck className="size-4 text-emerald-500" aria-hidden="true" />
              Chat closed. Units arrived on scene.
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Reply as the citizen…"
                className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none ring-ring/50 placeholder:text-muted-foreground focus:ring-2"
              />
              <button
                type="button"
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Console */}
      <aside className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="min-h-0 flex-1">
          <DispatchConsole
            slots={slots}
            category={category}
            dispatched={dispatched}
            phase={phase}
            etaMinutes={etaMinutes}
            escalate={escalate}
            centralLog={centralLog}
          />
        </div>
        <div className="flex flex-col gap-2 border-t border-border p-3">
          <label className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-xs font-medium">
            <span className="flex items-center gap-2">
              <MapPin className="size-3.5 text-primary" aria-hidden="true" />
              Auto check-ins (Phase 4)
            </span>
            <input
              type="checkbox"
              checked={autoMonitor}
              onChange={(e) => setAutoMonitor(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
          </label>
          <button
            type="button"
            onClick={handleArrival}
            disabled={!dispatched || closed}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Confirm unit arrival (close chat)
          </button>
        </div>
      </aside>
    </div>
  )
}
