"use client"

import {
  Ambulance,
  Flame,
  ShieldAlert,
  HelpCircle,
  MapPin,
  User,
  Users,
  Activity,
  CheckCircle2,
  Circle,
  Clock,
  Radio,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { EmergencyCategory, IntakePhase, Slots } from "@/lib/types"

const CATEGORY_META: Record<
  EmergencyCategory,
  { label: string; icon: typeof Ambulance; className: string }
> = {
  medical: { label: "Medical", icon: Ambulance, className: "text-sky-500" },
  security: { label: "Security", icon: ShieldAlert, className: "text-blue-500" },
  fire: { label: "Fire", icon: Flame, className: "text-orange-500" },
  other: { label: "Other", icon: HelpCircle, className: "text-muted-foreground" },
  unknown: {
    label: "Classifying…",
    icon: HelpCircle,
    className: "text-muted-foreground",
  },
}

const PHASE_LABELS: Record<IntakePhase, string> = {
  1: "Intake & Extraction",
  2: "Critical Data Recovery",
  3: "Triage & Instructions",
  4: "Active Monitoring",
}

function SlotRow({
  icon: Icon,
  label,
  value,
  critical,
}: {
  icon: typeof MapPin
  label: string
  value: string | null
  critical?: boolean
}) {
  const filled = Boolean(value)
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {critical && !filled && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Required
            </span>
          )}
        </div>
        <p
          className={cn(
            "truncate text-sm",
            filled ? "font-medium text-foreground" : "italic text-muted-foreground/70",
          )}
        >
          {value ?? "Awaiting…"}
        </p>
      </div>
      {filled ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
      )}
    </div>
  )
}

export function DispatchConsole({
  slots,
  category,
  dispatched,
  phase,
  etaMinutes,
  escalate,
  centralLog,
}: {
  slots: Slots
  category: EmergencyCategory
  dispatched: boolean
  phase: IntakePhase
  etaMinutes: number
  escalate: boolean
  centralLog: string[]
}) {
  const meta = CATEGORY_META[category]
  const CategoryIcon = meta.icon

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight">
            Dispatch Console
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Live structured data extracted by the AI agent
        </p>
      </div>

      {/* Dispatch status */}
      <div
        className={cn(
          "rounded-xl border p-3 transition-colors",
          dispatched
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-border bg-card",
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Unit status
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              dispatched ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                dispatched ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/40",
              )}
              aria-hidden="true"
            />
            {dispatched ? "DISPATCHED" : "Pending"}
          </span>
        </div>
        {dispatched && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Clock className="size-4 text-emerald-500" aria-hidden="true" />
            <span className="font-medium">ETA ~{etaMinutes} min</span>
          </div>
        )}
      </div>

      {/* Category + phase */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground">
            Category
          </span>
          <div className="mt-1.5 flex items-center gap-2">
            <CategoryIcon className={cn("size-5", meta.className)} aria-hidden="true" />
            <span className="text-sm font-semibold">{meta.label}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <span className="text-xs font-medium text-muted-foreground">Phase</span>
          <div className="mt-1.5 flex items-center gap-2">
            <Activity className="size-5 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold">{phase}</span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {PHASE_LABELS[phase]}
          </p>
        </div>
      </div>

      {/* Slots */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Extracted entities
        </span>
        <SlotRow icon={MapPin} label="Location" value={slots.location} critical />
        <SlotRow
          icon={AlertTriangle}
          label="Emergency type"
          value={slots.emergencyType}
          critical
        />
        <SlotRow icon={User} label="DNI / Name" value={slots.dni} />
        <SlotRow icon={Users} label="People involved" value={slots.peopleInvolved} />
      </div>

      {/* Central log */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Central dispatch log
        </span>
        <div className="flex-1 space-y-2 rounded-xl border border-border bg-card p-3">
          {centralLog.length === 0 ? (
            <p className="text-xs italic text-muted-foreground/70">
              No events reported to the central system yet.
            </p>
          ) : (
            centralLog.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 text-xs leading-relaxed",
                  escalate && i === centralLog.length - 1
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span className="text-pretty">{entry}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
