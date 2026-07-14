import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ManipulationVerbClass,
    ParseCommandInput,
    ParseCommandObjectMembershipIntentResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

/**
 * Phase A membership-atomic manipulation frame: classify language direction + enrich context.
 * Relational frames: {@link ManipulationFrame} in {@link ./manipulationFrame.ts}.
 */
export type MembershipManipulationFrame = {
    command: string
    rawObjectSpans: readonly string[]
    verbClass: ManipulationVerbClass
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export function buildMembershipManipulationFrame(
    input: Pick<
        ParseCommandInput,
        'command' | 'characterId' | 'hostRoomId' | 'roomObjectCatalog' | 'heldInventoryCatalog'
    >,
    intent: Pick<ParseCommandObjectMembershipIntentResult, 'rawObjectSpans' | 'verbClass'>
): MembershipManipulationFrame {
    return {
        command: input.command,
        rawObjectSpans: intent.rawObjectSpans,
        verbClass: intent.verbClass,
        characterId: input.characterId,
        hostRoomId: input.hostRoomId,
        roomObjectCatalog: input.roomObjectCatalog,
        heldInventoryCatalog: input.heldInventoryCatalog,
    }
}
