import { generateText, Output } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import type { ChatMessage, IntakeEvent } from "@/lib/types"

export const maxDuration = 30

const MODEL = anthropic("claude-3-5-haiku-20241022")

const resultSchema = z.object({
  slots: z.object({
    dni: z
      .string()
      .nullable()
      .describe("The citizen's DNI number or full name. Null if not provided."),
    location: z
      .string()
      .nullable()
      .describe(
        "Exact address, street + number, cross street, GPS or reference point. Null if not provided.",
      ),
    emergencyType: z
      .string()
      .nullable()
      .describe(
        "Short description of what is happening (the emergency). Null if not provided.",
      ),
    peopleInvolved: z
      .string()
      .nullable()
      .describe(
        "How many people are injured or involved. Null if not provided.",
      ),
  }),
  category: z
    .enum(["medical", "security", "fire", "other", "unknown"])
    .describe("Best classification of the emergency for dispatching specialists."),
  reply: z
    .string()
    .describe(
      "The WhatsApp message to send back to the citizen. Empty string if no message should be sent.",
    ),
  centralNote: z
    .string()
    .nullable()
    .describe(
      "Internal note routed to the 911 dispatch center. Null if there is nothing to report.",
    ),
  dispatched: z
    .boolean()
    .describe("True once location AND emergency type are known and a unit is sent."),
  phase: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .describe("Current phase of the intake flow."),
  escalate: z
    .boolean()
    .describe("True when the reporter is non-responsive and the event must be escalated."),
  etaMinutes: z
    .number()
    .describe("Approximate ETA in minutes for the responding unit (1-15)."),
})

const SYSTEM_PROMPT = `You are the 911 EMERGENCY INTAKE AGENT — the first point of contact between a citizen and the emergency response system, operating over WhatsApp in parallel with the phone operator. Your job is to capture structured data quickly, dispatch units as early as possible, and keep the reporter safe and calm.

You ALWAYS reply in the same language the citizen is writing in (Spanish or English). Keep messages short, calm, and clear, like real WhatsApp messages. Use emojis sparingly and only as in the templates (🚨 📍).

## The four required entities (slot-filling)
1. DNI / NAME — identification
2. LOCATION — exact address, cross street, GPS or reference point
3. EMERGENCY TYPE — what is happening
4. PEOPLE INVOLVED — how many injured/involved

Extract these from the ENTIRE conversation regardless of order or format. Accumulate: never drop a value the citizen already gave. A field is only null if it was never provided.

## Phase logic
- PHASE 1 — INTAKE: Parse the citizen's message and extract the four entities.
- If ALL required data is present on the first reply: set dispatched=true and jump to PHASE 3.
- PHASE 2 — CRITICAL DATA RECOVERY: If data is missing, ask EXACTLY ONE direct question per message, in this strict vital-priority order:
   1. Missing LOCATION (P0, critical) — ask for street & number or GPS. Do not proceed without it.
   2. Missing EMERGENCY TYPE (P1, critical) — ask what is happening to send the right specialists.
   3. Missing PEOPLE INVOLVED or DNI (P2, secondary) — only AFTER location + type are confirmed. Dispatch the unit FIRST, then ask for the remaining secondary data while help is on the way.
- The MOMENT both LOCATION and EMERGENCY TYPE are known, set dispatched=true. NEVER hold back dispatch waiting for secondary data (people involved, DNI).
- PHASE 3 — TRIAGE & SURVIVAL INSTRUCTIONS: Once "what" and "where" are confirmed, switch from data collector to survival assistant. Give protocol-specific guidance:
   - medical: ambulance en route; if not breathing, lay face-up on hard flat surface; ask if they know CPR.
   - security: police en route; find a safe place, hide, silence the phone; tell them not to reply if replying is risky.
   - fire: firefighters en route; evacuate via stairs, close doors without locking, never use elevators.
- PHASE 4 — ACTIVE MONITORING: periodic check-ins while the unit is en route.

## Rules (hard constraints)
- NEVER send a generic or static message — every reply is generated dynamically from the extracted entities and current phase.
- NEVER ask for more than one missing field per message.
- NEVER delay dispatch of a unit for secondary data once location + type are known.
- Prioritize LOCATION above everything.
- After dispatch, always acknowledge that help is on the way.

You will receive an EVENT describing why you are being invoked. Respond with structured data.`

function eventInstruction(event: IntakeEvent, etaMinutes: number): string {
  switch (event) {
    case "checkin":
      return `EVENT: PERIODIC CHECK-IN (Phase 4). The unit is about ${etaMinutes} minutes away. Generate a short reassuring check-in asking whether anything changed or there are new injuries, and tell them to reply 'ALL SAME' / 'TODO IGUAL' if everything is the same and they are safe. Set phase=4 and keep dispatched=true. Do not re-ask for already-collected data.`
    case "silence":
      return `EVENT: SILENCE TIMEOUT. The reporter did NOT respond to the previous check-in within the allowed time. Per protocol, DO NOT send another message to the citizen — set reply to an empty string. Instead set escalate=true and write a centralNote such as "The reporter has stopped responding. Possible escalation of the event." Keep phase=4 and dispatched=true.`
    case "arrival":
      return `EVENT: UNIT ARRIVAL CONFIRMED (GPS confirms the responding unit reached the location). Send the final closing message: tell them units have arrived, to make themselves visible if it is safe, that the chat is closing, and to stay strong. Keep dispatched=true, phase=4.`
    default:
      return `EVENT: NEW CITIZEN MESSAGE. Run slot-filling on the full conversation, decide the phase, dispatch if location + type are known, and produce the single best next message following the phase logic and rules.`
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages: ChatMessage[]
      event?: IntakeEvent
      etaMinutes?: number
    }

    const event: IntakeEvent = body.event ?? "citizen_message"
    const etaMinutes = body.etaMinutes ?? 8

    const history = (body.messages ?? [])
      .filter((m) => m.role === "agent" || m.role === "citizen")
      .map((m) => ({
        role: (m.role === "agent" ? "assistant" : "user") as
          | "assistant"
          | "user",
        content: m.content,
      }))

    const { output } = await generateText({
      model: MODEL,
      output: Output.object({ schema: resultSchema }),
      system: SYSTEM_PROMPT,
      messages: [
        ...history,
        {
          role: "user" as const,
          content: `[SYSTEM DIRECTIVE — not from the citizen]\n${eventInstruction(
            event,
            etaMinutes,
          )}`,
        },
      ],
    })

    return Response.json(output)
  } catch (err) {
    console.log("[v0] /api/intake error:", (err as Error).message)
    return Response.json(
      { error: "Failed to process intake" },
      { status: 500 },
    )
  }
}
