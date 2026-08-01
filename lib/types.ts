export type EmergencyCategory =
  | "medical"
  | "security"
  | "fire"
  | "other"
  | "unknown"

export type IntakePhase = 1 | 2 | 3 | 4

export type Slots = {
  /** DNI / name — identification */
  dni: string | null
  /** Exact address, cross street, or reference point */
  location: string | null
  /** Short description of what is happening */
  emergencyType: string | null
  /** How many people are injured or involved */
  peopleInvolved: string | null
}

export type IntakeEvent =
  | "citizen_message"
  | "checkin"
  | "silence"
  | "arrival"

export type ChatRole = "agent" | "citizen" | "system"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

/** Structured result returned by the AI intake endpoint. */
export type IntakeResult = {
  slots: Slots
  category: EmergencyCategory
  /** Message to send back to the citizen. Empty string means: send nothing. */
  reply: string
  /** Internal note routed to the 911 dispatch center (not shown to citizen). */
  centralNote: string | null
  /** True once location + emergency type are known and a unit has been sent. */
  dispatched: boolean
  /** Current phase of the intake flow. */
  phase: IntakePhase
  /** True when the reporter should be treated as non-responsive / escalated. */
  escalate: boolean
  /** Approximate ETA in minutes for the responding unit. */
  etaMinutes: number
}

export const EMPTY_SLOTS: Slots = {
  dni: null,
  location: null,
  emergencyType: null,
  peopleInvolved: null,
}
