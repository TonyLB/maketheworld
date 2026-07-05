import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass, RelationalOperationKind } from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

export type { RelationalOperationKind } from '../../baseClasses'

export type ObjectManipulationEnrichRoute = 'membership' | 'relational'

export type ManipulationFrameBuildInput = {
    enrichRoute: ObjectManipulationEnrichRoute
    command: string
    rawObjectSpans: readonly string[]
    verbClass?: ManipulationVerbClass
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

/**
 * Role-tagged manipulation frame from frame-extract LLM (raw player language, not EphemeraIds).
 * See {@link MembershipManipulationFrame} for Phase A membership-atomic input.
 */
export type ManipulationFrame = {
    command: string
    subjectSpan: string
    targetSpan: string
    relationSpan: string
    operationKind: RelationalOperationKind
    verbClass?: ManipulationVerbClass
    rawObjectSpans: readonly string[]
    characterId?: EphemeraCharacterId
    hostRoomId?: EphemeraRoomId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type ManipulationFrameExtractModelResponse = {
    subjectSpan: string
    targetSpan: string
    relationSpan: string
    operationKind: RelationalOperationKind
}

export function buildManipulationFrameFromExtract(
    input: ManipulationFrameBuildInput,
    extractResponse: ManipulationFrameExtractModelResponse
): ManipulationFrame {
    return {
        command: input.command,
        subjectSpan: extractResponse.subjectSpan,
        targetSpan: extractResponse.targetSpan,
        relationSpan: extractResponse.relationSpan,
        operationKind: extractResponse.operationKind,
        ...(input.verbClass !== undefined ? { verbClass: input.verbClass } : {}),
        rawObjectSpans: input.rawObjectSpans,
        characterId: input.characterId,
        hostRoomId: input.hostRoomId,
        roomObjectCatalog: input.roomObjectCatalog,
        heldInventoryCatalog: input.heldInventoryCatalog,
    }
}
