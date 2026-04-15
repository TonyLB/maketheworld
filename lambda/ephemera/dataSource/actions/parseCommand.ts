import { invokeBedrockParseCommand } from '../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { buildParseCommandIntentClassificationPrompt } from './buildParseCommandIntentClassificationPrompt'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

/**
 * Classifies free-form command text via LLM: `AwaitRoadRunner` and `AcmeOrder` (same tier, before `Unimplemented` / `Unknown`), with strict JSON validation.
 */
export async function parseCommand(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandResult> {
    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const prompt = buildParseCommandIntentClassificationPrompt(input.command)
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { type: 'Error', errorMessage: invokeResult.errorMessage }
    }
    return interpretParseCommandIntentClassificationBody(invokeResult.body)
}
