import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type {
    ManipulationVerbClass,
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import { evaluateCardinalityGate } from './cardinalityGate'
import { compileMembershipAtomic, type CompileMembershipAtomicDeps } from './compileMembershipAtomic'
import { complexErrorMessage } from './complexityClasses'

export type EnrichObjectManipulationInput = {
    command: string
    rawObjectSpans: readonly string[]
    verbClass: ManipulationVerbClass
    characterId?: EphemeraCharacterId
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
    heldInventoryCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type EnrichObjectManipulationResult = ParseCommandObjectManipulationResult | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = CompileMembershipAtomicDeps

export async function enrichObjectManipulation(
    input: EnrichObjectManipulationInput,
    intentConfidence: number,
    deps: EnrichObjectManipulationDeps = {}
): Promise<EnrichObjectManipulationResult> {
    const cardinalityOutcome = evaluateCardinalityGate(input.rawObjectSpans)
    if (cardinalityOutcome.type === 'complex') {
        return {
            type: 'Error',
            errorMessage: complexErrorMessage(cardinalityOutcome.complexityClass),
        }
    }

    return compileMembershipAtomic(
        {
            command: input.command,
            rawObjectSpans: input.rawObjectSpans,
            verbClass: input.verbClass,
            characterId: input.characterId,
            roomObjectCatalog: input.roomObjectCatalog,
            heldInventoryCatalog: input.heldInventoryCatalog,
        },
        intentConfidence,
        deps
    )
}
