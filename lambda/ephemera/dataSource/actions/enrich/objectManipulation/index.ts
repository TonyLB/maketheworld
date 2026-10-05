import type {
    ParseCommandAbstainResult,
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
} from '../../baseClasses'
import {
    compileRelationalFromSkeleton,
    type CompileRelationalFromSkeletonDeps,
} from './compileRelationalFromSkeleton'
import type { ManipulationFrameBuildInput } from './manipulationFrame'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type EnrichObjectManipulationInput = ManipulationFrameBuildInput

export type EnrichObjectManipulationResult =
    | ParseCommandEstablishRelationResult
    | ParseCommandConsultResult
    | ParseCommandAbstainResult
    | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = CompileRelationalFromSkeletonDeps

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
        if (input.parseSkeleton === undefined || input.attempt === undefined) {
            return { type: 'Error', errorMessage: objectManipulationErrorMessages.relationalNoTemplateMatch }
        }
        return compileRelationalFromSkeleton(
            {
                command: input.command,
                skeleton: input.parseSkeleton,
                attempt: input.attempt,
                characterId: input.characterId,
                hostRoomId: input.hostRoomId,
                roomObjectCatalog: input.roomObjectCatalog,
                heldInventoryCatalog: input.heldInventoryCatalog,
            },
            intentConfidence,
            deps
        )
    }

    // Membership (take, drop, containment) routes through compileTransferFromSkeleton (ISS8203 slice 3).
    return {
        type: 'Error',
        errorMessage: objectManipulationErrorMessages.relationalNoTemplateMatch,
    }
}
