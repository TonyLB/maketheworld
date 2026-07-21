import { invokeBedrockParseCommand } from '../../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from '../baseClasses'
import { buildIntentClassificationPrompt } from './buildIntentClassificationPrompt'
import { deterministicIntentChecks } from './deterministicChecks'
import { interpretIntentClassificationBody } from './intentClassification'

export type DiscriminateIntentResult = ParseCommandResult

/**
 * Iteration 7, Sub-iteration 1: classify decides only realness/shape
 * (`MultipleCommands` / `PromptInjectionAttempt` / `Unknown`) and, for a legitimate
 * single in-world engagement, command-vs-question (`Command` / `WorldQuestion`).
 * Deterministic pre-checks (bare words, take/get/drop, exact exit names) still run
 * first and bypass classify entirely --- see `deterministicChecks.ts`.
 */
export async function discriminateIntent(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<DiscriminateIntentResult> {
    const deterministicResult = deterministicIntentChecks(input)
    if (deterministicResult) {
        return deterministicResult
    }

    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const prompt = buildIntentClassificationPrompt(input.command)
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { type: 'Error', errorMessage: invokeResult.errorMessage }
    }

    return interpretIntentClassificationBody(invokeResult.body)
}
