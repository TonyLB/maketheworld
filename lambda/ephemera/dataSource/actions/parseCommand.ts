import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandLookRoomResult } from './baseClasses'
import { discriminateIntent } from './discriminateIntent'
export { navigationIntentErrorMessages } from './discriminateIntent/exitResolution'
export { objectManipulationErrorMessages } from './enrich/objectManipulation/resolveObjectSpan'
import { enrichAcmeOrder } from './enrich/acmeOrder'
import { enrichObjectManipulation } from './enrich/objectManipulation'
import { objectSpansFromSkeleton } from './enrich/objectManipulation/parse/objectSpansFromSkeleton'
import { runParseStage } from './enrich/objectManipulation/parse/runParseStage'
import { deterministicIntentChecks } from './discriminateIntent/deterministicChecks'

/** Acme order enrich chain-of-reason Markdown only; use with {@link parseCommandWithEnrichReasoning} for harness review. */
export type ParseCommandWithEnrichReasoningResult = {
    result: ParseCommandResult;
    enrichReasoningMarkdown: string;
    enrichRawBody?: string;
};

async function parseCommandCore(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    const intentResult = await discriminateIntent(input, deps)

    if (intentResult.type === 'ObjectMembershipIntent') {
        // Step 2a/Step 3 (BD-21): Parse's tokenized skeleton is the sole source of
        // rawObjectSpans for commands that reach classify's LLM -- the deterministic fast
        // path (take/get/drop) stays zero-Bedrock and supplies its own self-built spans
        // (deterministicIntentChecks), re-checked here rather than calling Parse
        // unconditionally. Classify's own inline objectSpans extraction has been retired
        // (Step 3); on Parse failure for an LLM-routed command, hard-fail rather than
        // falling back to it, mirroring the ObjectRelateIntent branch below.
        const tookDeterministicPath = deterministicIntentChecks(input) !== null
        let rawObjectSpans: string[]
        if (tookDeterministicPath) {
            rawObjectSpans = intentResult.rawObjectSpans
        } else {
            const parseResult = await runParseStage(
                { command: input.command },
                { invokeBedrockObjectManipulationParseImpl: deps.invokeBedrockObjectManipulationParseImpl }
            )
            if (parseResult.type !== 'success') {
                return {
                    result: { type: 'Error', errorMessage: parseResult.errorMessage },
                    enrichReasoningMarkdown: '',
                    enrichRawBody: undefined,
                }
            }
            rawObjectSpans = objectSpansFromSkeleton(parseResult.tokens)
        }

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'membership',
                command: input.command,
                rawObjectSpans,
                verbClass: intentResult.verbClass,
                characterId: input.characterId,
                hostRoomId: input.hostRoomId,
                roomObjectCatalog: input.roomObjectCatalog,
                heldInventoryCatalog: input.heldInventoryCatalog,
            },
            intentResult.confidence,
            {
                invokeBedrockObjectManipulationEnrichImpl: deps.invokeBedrockObjectManipulationEnrichImpl,
                invokeBedrockObjectManipulationComplexityImpl: deps.invokeBedrockObjectManipulationComplexityImpl,
                positionsReadDeps: deps.objectManipulationPositionsReadDeps,
                embedSpan: deps.embedSpan,
            }
        )
        return { result, enrichReasoningMarkdown: '', enrichRawBody: undefined }
    }

    if (intentResult.type === 'ObjectRelateIntent') {
        // Step 2b step 6 (BD-21/BD-22/BD-23): the relational route now runs entirely
        // through the native pipeline (Plan match -> Identify -> Grounding ->
        // Validation, see compileRelationalFromSkeleton.ts) instead of frame-extract +
        // compileRelational.ts. Unlike Step 2a's membership wiring, Parse runs
        // unconditionally here (deterministicIntentChecks never produces
        // ObjectRelateIntent, so there's no zero-Bedrock path to protect) and there
        // is deliberately no fallback to the legacy flow on Parse failure --- see
        // enrich/objectManipulation/AGENT.md (relational branch).
        const parseResult = await runParseStage(
            { command: input.command },
            { invokeBedrockObjectManipulationParseImpl: deps.invokeBedrockObjectManipulationParseImpl }
        )
        if (parseResult.type === 'error') {
            return {
                result: { type: 'Error', errorMessage: parseResult.errorMessage },
                enrichReasoningMarkdown: '',
                enrichRawBody: undefined,
            }
        }

        const result = await enrichObjectManipulation(
            {
                enrichRoute: 'relational',
                command: input.command,
                // Vestigial: the relational route resolves spans entirely from parseSkeleton
                // (see enrich/objectManipulation/index.ts); this only satisfies
                // ManipulationFrameBuildInput's shared required field.
                rawObjectSpans: [],
                parseSkeleton: parseResult.tokens,
                characterId: input.characterId,
                hostRoomId: input.hostRoomId,
                roomObjectCatalog: input.roomObjectCatalog,
                heldInventoryCatalog: input.heldInventoryCatalog,
            },
            intentResult.confidence,
            {
                positionsReadDeps: deps.objectManipulationPositionsReadDeps,
                embedSpan: deps.embedSpan,
            }
        )
        return { result, enrichReasoningMarkdown: '', enrichRawBody: undefined }
    }

    if (intentResult.type !== 'AcmeOrderIntent') {
        return { result: intentResult, enrichReasoningMarkdown: '', enrichRawBody: undefined }
    }

    const { result, enrichReasoningMarkdown, enrichRawBody } = await enrichAcmeOrder(
        {
            command: input.command,
            occupiedStableKeys: input.occupiedStableKeys ?? [],
            intentRawOrders: intentResult.rawOrders,
        },
        intentResult.confidence,
        {
            messageBus: deps.messageBus,
            invokeBedrockAcmeOrderEnrichImpl: deps.invokeBedrockAcmeOrderEnrichImpl,
            countCoyotePlacedObjectsAcrossRoomsDeps: deps.countCoyotePlacedObjectsAcrossRoomsDeps,
        }
    )
    return { result, enrichReasoningMarkdown, enrichRawBody }
}

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **bare `look` / `l`** returns **`LookRoom`**; **bare `help`** returns **`Help`**; **bare `home`** returns **`Home`**; minimal-verb **`take` / `drop` / `get <object>`** returns **`ObjectMembershipIntent`**: all without Bedrock classify.
 * Otherwise runs intent discrimination, then runs Acme order enrich when intent is **`AcmeOrderIntent`**
 * and object manipulation enrich when intent is **`ObjectMembershipIntent`** or **`ObjectRelateIntent`**. Intent outcomes
 * **`PromptInjectionAttempt`**, **`Unknown`**, **`Unimplemented`**, and others pass through without enrich.
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
 * Same pipeline as **`parseCommand`** (including **bare `look` / `l`**, **bare `help`**, Coyote test shortcuts without Bedrock, and intent terminals like **`PromptInjectionAttempt`** without Acme enrich), plus Acme order enrich **`enrichReasoningMarkdown`** for manual review (affinities harness). Does not add that string to **`AcmeOrder`**.
 */
export async function parseCommandWithEnrichReasoning(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    return parseCommandCore(input, deps)
}
