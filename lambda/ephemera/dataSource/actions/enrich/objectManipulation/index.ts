import type {
    ParseCommandConsultResult,
    ParseCommandErrorResult,
    ParseCommandEstablishRelationResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import { evaluateCardinalityGate } from './cardinalityGate'
import { compileMembershipAtomic, type CompileMembershipAtomicDeps } from './compileMembershipAtomic'
import { compileRelational, type CompileRelationalDeps } from './compileRelational'
import { complexErrorMessage } from './complexityClasses'
import { runFrameExtractStage, type FrameExtractStageDeps } from './frameExtract/runFrameExtractStage'
import type { ManipulationFrameBuildInput } from './manipulationFrame'

export type EnrichObjectManipulationInput = ManipulationFrameBuildInput

export type EnrichObjectManipulationResult =
    | ParseCommandObjectManipulationResult
    | ParseCommandEstablishRelationResult
    | ParseCommandConsultResult
    | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = CompileMembershipAtomicDeps & FrameExtractStageDeps & CompileRelationalDeps

export async function enrichObjectManipulation(
    input: EnrichObjectManipulationInput,
    intentConfidence: number,
    deps: EnrichObjectManipulationDeps = {}
): Promise<EnrichObjectManipulationResult> {
    if (input.enrichRoute === 'relational') {
        const extractResult = await runFrameExtractStage(input, deps)
        if (extractResult.type === 'error') {
            return { type: 'Error', errorMessage: extractResult.errorMessage }
        }
        return compileRelational(extractResult.frame, intentConfidence, deps)
    }

    const cardinalityOutcome = evaluateCardinalityGate(input.rawObjectSpans)
    if (cardinalityOutcome.type === 'complex') {
        return {
            type: 'Error',
            errorMessage: complexErrorMessage(cardinalityOutcome.complexityClass),
        }
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
            roomObjectCatalog: input.roomObjectCatalog,
            heldInventoryCatalog: input.heldInventoryCatalog,
        },
        intentConfidence,
        deps
    )
}
