import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import { compileMembershipAtomic, type CompileMembershipAtomicDeps } from './compileMembershipAtomic'
import {
    compileRelationalFromSkeleton,
    type CompileRelationalFromSkeletonDeps,
} from './compileRelationalFromSkeleton'
import type { ManipulationFrameBuildInput } from './manipulationFrame'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type EnrichObjectManipulationInput = ManipulationFrameBuildInput

export type EnrichObjectManipulationResult =
    | ParseCommandObjectManipulationResult
    | ParseCommandEstablishRelationResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = CompileMembershipAtomicDeps & CompileRelationalFromSkeletonDeps

export async function enrichObjectManipulation(
    input: EnrichObjectManipulationInput,
    intentConfidence: number,
    deps: EnrichObjectManipulationDeps = {}
): Promise<EnrichObjectManipulationResult> {
    if (input.enrichRoute === 'relational') {
        // Relational's only live source is now Parse's skeleton, fed by
        // parseCommand.ts's ObjectRelateIntent branch, which never calls this
        // route without one (no frame-extract fallback -- see AGENT.md,
        // relational branch). Defensive only, not reachable today.
        if (input.parseSkeleton === undefined) {
            return { type: 'Error', errorMessage: objectManipulationErrorMessages.relationalNoTemplateMatch }
        }
        return compileRelationalFromSkeleton(
            {
                command: input.command,
                skeleton: input.parseSkeleton,
                characterId: input.characterId,
                hostRoomId: input.hostRoomId,
                roomObjectCatalog: input.roomObjectCatalog,
                heldInventoryCatalog: input.heldInventoryCatalog,
            },
            intentConfidence,
            deps
        )
    }

    if (input.verbClass === undefined) {
        return {
            type: 'Error',
            errorMessage: 'Membership manipulation enrich requires verbClass from classify',
        }
    }

    return compileMembershipAtomic(
        {
            command: input.command,
            rawObjectSpans: input.rawObjectSpans,
            verbClass: input.verbClass,
            characterId: input.characterId,
            hostRoomId: input.hostRoomId,
            roomObjectCatalog: input.roomObjectCatalog,
            heldInventoryCatalog: input.heldInventoryCatalog,
        },
        intentConfidence,
        deps
    )
}
