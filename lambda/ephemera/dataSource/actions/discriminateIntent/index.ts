import { invokeBedrockParseCommand } from '../../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandAcmeOrderIntentResult, ParseCommandDeps, ParseCommandInput, ParseCommandResult } from '../baseClasses'
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

    const discriminatedIntent = interpretIntentClassificationBody(invokeResult.body)
    if (!isParseCommandNavigationIntentResult(discriminatedIntent)) {
        return discriminatedIntent
    }

    const resolved = resolveExitLabelToTargetId(input, discriminatedIntent.exitCandidate)
    if (resolved.type === 'Resolved') {
        return {
            type: 'Navigation',
            targetId: resolved.targetId,
            confidence: discriminatedIntent.confidence,
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
