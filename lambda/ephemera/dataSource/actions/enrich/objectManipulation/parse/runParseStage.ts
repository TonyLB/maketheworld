import { invokeBedrockObjectManipulationParse } from '../../../../../generateExample/invokeBedrockObjectManipulationParse'

import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import { buildParsePrompt } from './buildParsePrompt'
import { interpretParseBody } from './interpretParse'
import type { ParseSkeleton } from './parseToken'
import { stampStableRefKeys } from './stampStableRefKeys'

export type ParseStageInput = {
    command: string
}

export type ParseStageResult =
    | { type: 'success'; tokens: ParseSkeleton }
    | { type: 'error'; errorMessage: string }

export type ParseStageDeps = {
    invokeBedrockObjectManipulationParseImpl?: typeof invokeBedrockObjectManipulationParse
}

export async function runParseStage(
    input: ParseStageInput,
    deps: ParseStageDeps = {}
): Promise<ParseStageResult> {
    const invokeParse = deps.invokeBedrockObjectManipulationParseImpl
        ?? invokeBedrockObjectManipulationParse
    const promptParts = buildParsePrompt(input)
    const invokeResult = await invokeParse(promptParts)
    if (!invokeResult.success) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.parseInvokeFailed,
        }
    }

    const parsed = interpretParseBody(invokeResult.body)
    if (!parsed.success) {
        return { type: 'error', errorMessage: parsed.errorMessage }
    }

    return {
        type: 'success',
        tokens: stampStableRefKeys(parsed.response.tokens),
    }
}
