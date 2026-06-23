import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import { buildParseObjectManipulationEnrichPrompt } from './buildPrompt'
import {
    finalizeObjectManipulationFromEnrich,
    interpretObjectManipulationEnrichBody,
    type ObjectManipulationEnrichModelResponse,
} from './interpretAndFinalize'

export type EnrichObjectManipulationInput = {
    command: string
    rawObjectSpans: readonly string[]
    roomObjectCatalog?: readonly RoomInPlayObjectCatalogEntry[]
}

export type EnrichObjectManipulationResult = ParseCommandObjectManipulationResult | ParseCommandErrorResult

export type EnrichObjectManipulationDeps = {
    invokeBedrockObjectManipulationEnrichImpl?: typeof invokeBedrockObjectManipulationEnrich
}

export async function enrichObjectManipulation(
    input: EnrichObjectManipulationInput,
    intentConfidence: number,
    deps: EnrichObjectManipulationDeps = {}
): Promise<EnrichObjectManipulationResult> {
    const catalog = input.roomObjectCatalog ?? []
    const invokeEnrich = deps.invokeBedrockObjectManipulationEnrichImpl ?? invokeBedrockObjectManipulationEnrich
    const enrichPromptParts = buildParseObjectManipulationEnrichPrompt(input.command, {
        rawObjectSpans: input.rawObjectSpans,
        catalog,
    })
    const enrichInvoke = await invokeEnrich(enrichPromptParts)

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: ObjectManipulationEnrichModelResponse | null = null
    let parseFailureReason: string | undefined

    if (enrichInvoke.success) {
        const parsed = interpretObjectManipulationEnrichBody(enrichInvoke.body)
        if (parsed.success) {
            enrichResponse = parsed.response
        } else {
            enrichInvokeFailed = true
            parseFailureReason = parsed.errorMessage
        }
    }

    const result = finalizeObjectManipulationFromEnrich(
        intentConfidence,
        enrichResponse,
        enrichInvokeFailed,
        catalog
    )

    if (enrichInvokeFailed && result.type === 'Error' && parseFailureReason !== undefined) {
        return { type: 'Error', errorMessage: parseFailureReason }
    }

    return result
}
