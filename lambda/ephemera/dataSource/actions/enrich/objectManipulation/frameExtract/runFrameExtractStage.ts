import { invokeBedrockObjectManipulationEnrich } from '../../../../../generateExample/invokeBedrockObjectManipulationEnrich'

import {
    buildManipulationFrameFromExtract,
    type ManipulationFrame,
    type ManipulationFrameBuildInput,
} from '../manipulationFrame'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import { buildManipulationFrameExtractPrompt } from './buildFrameExtractPrompt'
import { interpretManipulationFrameExtractBody } from './interpretFrameExtract'

export type FrameExtractStageResult =
    | { type: 'success'; frame: ManipulationFrame }
    | { type: 'error'; errorMessage: string }

export type FrameExtractStageDeps = {
    invokeBedrockObjectManipulationFrameExtractImpl?: typeof invokeBedrockObjectManipulationEnrich
}

export async function runFrameExtractStage(
    input: ManipulationFrameBuildInput,
    deps: FrameExtractStageDeps = {}
): Promise<FrameExtractStageResult> {
    const invokeFrameExtract = deps.invokeBedrockObjectManipulationFrameExtractImpl
        ?? invokeBedrockObjectManipulationEnrich
    const promptParts = buildManipulationFrameExtractPrompt(input)
    const invokeResult = await invokeFrameExtract(promptParts)
    if (!invokeResult.success) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.frameExtractInvokeFailed,
        }
    }

    const parsed = interpretManipulationFrameExtractBody(invokeResult.body)
    if (!parsed.success) {
        return { type: 'error', errorMessage: parsed.errorMessage }
    }

    return {
        type: 'success',
        frame: buildManipulationFrameFromExtract(input, parsed.response),
    }
}
