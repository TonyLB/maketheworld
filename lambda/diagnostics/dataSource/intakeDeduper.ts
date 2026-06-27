import { MessageBus } from '../messageBus/baseClasses'

/**
 * Per-invocation dedup for problem-report intake (Session Disconnect Problem,
 * Spawn Compensation Problem). Under publish, concurrent handler invocations may
 * receive the same dedupeKey; only the first successful claim triggers sweep
 * evaluation in this lambda invocation.
 */
class DiagnosticsIntakeDeduper {
    private claimedDedupeKeys = new Set<string>()

    tryClaim(dedupeKey: string): boolean {
        if (this.claimedDedupeKeys.has(dedupeKey)) {
            return false
        }
        this.claimedDedupeKeys.add(dedupeKey)
        return true
    }

    reset(): void {
        this.claimedDedupeKeys.clear()
    }

    registerDeferral(messageBus: MessageBus): void {
        messageBus.registerDeferral('diagnosticsIntakeDedup', {
            onClear: () => this.reset(),
            afterSettled: async () => {},
        })
    }
}

export const diagnosticsIntakeDeduper = new DiagnosticsIntakeDeduper()
