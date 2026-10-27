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
 * Deterministic pre-checks (the intent rows, then every command one of Plan's templates fits,
 * which the bare exit template makes every command) run first and bypass classify --- see
 * `deterministicChecks.ts`; classify is reached through `classifyIntent`, when the fast path
 * abstains (`parseCommand.ts`), or for an empty command.
 */
export async function discriminateIntent(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<DiscriminateIntentResult> {
    return deterministicIntentChecks(input) ?? classifyIntent(input, deps)
}

/** The Bedrock classify alone: where a command the fast path claimed and then abstained on climbs to. */
export async function classifyIntent(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<DiscriminateIntentResult> {
    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const prompt = buildIntentClassificationPrompt(input.command)
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { type: 'Error', errorMessage: invokeResult.errorMessage }
    }

    return interpretIntentClassificationBody(invokeResult.body)
}
