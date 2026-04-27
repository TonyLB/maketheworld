import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandLookRoomResult } from './baseClasses'
import { discriminateIntent } from './discriminateIntent'
export { navigationIntentErrorMessages } from './discriminateIntent/exitResolution'
import { enrichAcmeOrder } from './enrich/acmeOrder'

/** Step B chain-of-reason Markdown only; use with {@link parseCommandWithEnrichReasoning} for harness review. */
export type ParseCommandWithEnrichReasoningResult = {
    result: ParseCommandResult;
    enrichReasoningMarkdown: string;
};

async function parseCommandCore(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    const intentResult = await discriminateIntent(input, deps)

    if (intentResult.type !== 'AcmeOrderIntent') {
        return { result: intentResult, enrichReasoningMarkdown: '' }
    }

    const { result, enrichReasoningMarkdown } = await enrichAcmeOrder(
        {
            command: input.command,
            occupiedStableKeys: input.occupiedStableKeys ?? [],
        },
        intentResult.confidence,
        deps.invokeBedrockAcmeOrderEnrichImpl
    )
    return { result, enrichReasoningMarkdown }
}

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **bare `look` / `l`** returns **`LookRoom`**; **bare `help`** returns **`Help`**: all without Bedrock.
 * Otherwise runs intent discrimination, then runs Acme Step B only when intent is **`AcmeOrderIntent`**. Intent outcomes **`PromptInjectionAttempt`**, **`Unknown`**, **`Unimplemented`**, and others pass through without Acme enrich.
 * Enrich chain-of-reason Markdown is not attached to **`AcmeOrder`**; use {@link parseCommandWithEnrichReasoning} when needed (e.g. affinities harness).
 */
export async function parseCommand(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandResult> {
    const { result } = await parseCommandCore(input, deps)
    if (isParseCommandLookRoomResult(result)) {
        const preview = input.command.trim().slice(0, 120)
        console.log('[mtw.ephemera.parseCommand] LookRoom', {
            confidence: result.confidence,
            commandPreview: preview,
        })
    }
    return result
}

/**
 * Same pipeline as **`parseCommand`** (including **bare `look` / `l`**, **bare `help`**, Coyote test shortcuts without Bedrock, and intent terminals like **`PromptInjectionAttempt`** without Acme enrich), plus Step B **`enrichReasoningMarkdown`** for manual review (affinities harness). Does not add that string to **`AcmeOrder`**.
 */
export async function parseCommandWithEnrichReasoning(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    return parseCommandCore(input, deps)
}
