import { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { MessageBus } from '../messageBus/baseClasses'

/**
 * Per-invocation dedup for checkLocation repair. Under publish, concurrent handler
 * invocations may expand to the same characterId; only the first successful claim
 * runs repair for that character in this lambda invocation (first claim wins; no
 * flag-merging across duplicate payloads).
 */
class CheckLocationCoalescer {
    private repairedCharacterIds = new Set<EphemeraCharacterId>()

    tryClaim(characterId: EphemeraCharacterId): boolean {
        if (this.repairedCharacterIds.has(characterId)) {
            return false
        }
        this.repairedCharacterIds.add(characterId)
        return true
    }

    reset(): void {
        this.repairedCharacterIds.clear()
    }

    registerDeferral(messageBus: MessageBus): void {
        messageBus.registerDeferral('checkLocation', {
            onClear: () => this.reset(),
            afterSettled: async () => {},
        })
    }
}

export const checkLocationCoalescer = new CheckLocationCoalescer()
