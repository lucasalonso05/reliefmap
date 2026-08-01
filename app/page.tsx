import { Siren } from "lucide-react"
import { EmergencyChat } from "@/components/emergency-chat"

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-background font-sans">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Siren className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-balance">
              ReliefMap — 911 WhatsApp Intake Agent
            </h1>
            <p className="text-xs text-muted-foreground">
              AI slot-filling · triage · active monitoring · live dispatch console
            </p>
          </div>
        </div>
      </header>
      <div className="flex-1 px-4 py-6">
        <EmergencyChat />
      </div>
    </main>
  )
}
