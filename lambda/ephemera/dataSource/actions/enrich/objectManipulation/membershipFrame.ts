import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ManipulationVerbClass,
    ParseCommandInput,
    ParseCommandObjectManipulationIntentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

/**
 * Phase A membership-atomic manipulation frame: classify language direction + enrich context.
 * Phase B extends with role-tagged spans (subject, target, relationSpan).
 */
export type MembershipManipulationFrame = {
    command: string
    rawObjectSpans: readonly string[]
    verbClass: ManipulationVerbClass
    characterId?: EphemeraCharacterId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export function buildMembershipManipulationFrame(
    input: Pick<
        ParseCommandInput,
        'command' | 'characterId' | 'roomObjectCatalog' | 'heldInventoryCatalog'
    >,
    intent: Pick<ParseCommandObjectManipulationIntentResult, 'rawObjectSpans' | 'verbClass'>
): MembershipManipulationFrame {
    return {
        command: input.command,
        rawObjectSpans: intent.rawObjectSpans,
        verbClass: intent.verbClass,
        characterId: input.characterId,
        roomObjectCatalog: input.roomObjectCatalog,
        heldInventoryCatalog: input.heldInventoryCatalog,
    }
}
