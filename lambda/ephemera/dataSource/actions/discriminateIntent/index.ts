import { invokeBedrockParseCommand } from '../../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from '../baseClasses'
import type { ParseCommandAcmeOrderIntentResult } from './baseClasses'
import { isParseCommandNavigationIntentResult } from './baseClasses'
import { buildIntentClassificationPrompt } from './buildIntentClassificationPrompt'
import { deterministicIntentChecks } from './deterministicChecks'
import { navigationIntentErrorMessages, resolveExitLabelToTargetId } from './exitResolution'
import { interpretIntentClassificationBody } from './intentClassification'

export type DiscriminateIntentResult = ParseCommandResult | ParseCommandAcmeOrderIntentResult

export async function discriminateIntent(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<DiscriminateIntentResult> {
    const deterministicResult = deterministicIntentChecks(input)
    if (deterministicResult) {
        return deterministicResult
    }

    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const prompt = buildIntentClassificationPrompt(input.command, {
        movementExitLabels: [...new Set((input.roomExits ?? []).map(({ normalizedName }) => normalizedName))],
    })
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { type: 'Error', errorMessage: invokeResult.errorMessage }
    }

    const stepA = interpretIntentClassificationBody(invokeResult.body)
    if (!isParseCommandNavigationIntentResult(stepA)) {
        return stepA
    }

    const resolved = resolveExitLabelToTargetId(input, stepA.exitCandidate)
    if (resolved.type === 'Resolved') {
        return {
            type: 'Navigation',
            targetId: resolved.targetId,
            confidence: stepA.confidence,
        }
    }
    if (resolved.type === 'NoExitContext') {
        return { type: 'Error', errorMessage: navigationIntentErrorMessages.noExitContext }
    }
    if (resolved.type === 'AmbiguousMatch') {
        return { type: 'Error', errorMessage: navigationIntentErrorMessages.ambiguousMatch }
    }
    return { type: 'Error', errorMessage: navigationIntentErrorMessages.noMatch }
}
