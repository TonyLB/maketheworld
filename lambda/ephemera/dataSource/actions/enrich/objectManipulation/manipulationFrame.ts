import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass, RelationalOperationKind } from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import type { ParseSkeleton } from './parse/parseToken'

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
    /** Step 2b step 6: Parse's skeleton, required on the relational route (native pipeline, no frame-extract fallback). */
    parseSkeleton?: ParseSkeleton
}

/**
 * Role-tagged manipulation frame, still consumed by the unwired Phase C sandbox
 * compiler ({@link ../plan/compileUngroundedPlan.ts}). See {@link MembershipManipulationFrame}
 * for Phase A membership-atomic input.
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
