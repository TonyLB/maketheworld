import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass } from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

export type ManipulationFrameBuildInput = {
    command: string
    rawObjectSpans: readonly string[]
    verbClass: ManipulationVerbClass
    characterId?: EphemeraCharacterId
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
    verbClass: ManipulationVerbClass
    rawObjectSpans: readonly string[]
    characterId?: EphemeraCharacterId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type ManipulationFrameExtractModelResponse = {
    subjectSpan: string
    targetSpan: string
    relationSpan: string
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
        verbClass: input.verbClass,
        rawObjectSpans: input.rawObjectSpans,
        characterId: input.characterId,
        roomObjectCatalog: input.roomObjectCatalog,
        heldInventoryCatalog: input.heldInventoryCatalog,
    }
}
