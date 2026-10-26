import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandLookRoomResult } from './baseClasses'
import { classifyIntent, discriminateIntent } from './discriminateIntent'
export { navigationIntentErrorMessages } from './discriminateIntent/exitResolution'
export { objectManipulationErrorMessages } from './enrich/objectManipulation/resolveObjectSpan'
import { compileAttemptsFromSkeleton } from './enrich/objectManipulation/compileAttemptsFromSkeleton'
import { runParseStage } from './enrich/objectManipulation/parse/runParseStage'
import { planSkeleton, planTokens } from './enrich/objectManipulation/plan/planSkeleton'
import { matchNonObjectManipulationTemplate } from './deterministicTemplate'
import { matchNavigationParaphrase } from './plan/matchNavigationParaphrase'
import { matchAcmeOrderFamily } from './plan/matchAcmeOrderFamily'

/** Acme order enrich chain-of-reason Markdown only; use with {@link parseCommandWithEnrichReasoning} for harness review. */
export type ParseCommandWithEnrichReasoningResult = {
    result: ParseCommandResult;
    enrichReasoningMarkdown: string;
    enrichRawBody?: string;
};

const answer = (result: ParseCommandResult): ParseCommandWithEnrichReasoningResult => ({ result, enrichReasoningMarkdown: '', enrichRawBody: undefined })

/**
 * The producers are a ladder ordered by cost (BD-19). A rung's Abstain (not understood, FT-3.2) hands the
 * command to the next rung; an Error, a Consult or an attempt is an answer on any rung. Only the top
 * rung's Abstain reaches the player.
 */
async function parseCommandCore(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    const intentResult = await discriminateIntent(input, deps)

    if (intentResult.type === 'ObjectManipulationIntent') {
        // Only reachable via deterministicIntentChecks's take/get/drop/put/place fast path (iteration 7,
        // Sub-iteration 1). Plan reads every template over the command's tokens; each segmentation
        // its readings make is a fill.
        const fills = planTokens(intentResult.tokens, input.command)
        // Zero attempts is not understood on this rung, like an Abstain: both climb to the LLM route.
        if (fills.length > 0) {
            const result = await compileAttemptsFromSkeleton(
                {
                    command: input.command,
                    fills,
                    characterId: input.characterId,
                    hostRoomId: input.hostRoomId,
                    roomObjectCatalog: input.roomObjectCatalog,
                    heldInventoryCatalog: input.heldInventoryCatalog,
                },
                intentResult.confidence,
                {
                    embedSpan: deps.embedSpan,
                    positionsReadDeps: deps.objectManipulationPositionsReadDeps,
                }
            )
            if (result.type !== 'Abstain') {
                return answer(result)
            }
        }
        return routeClassifiedIntent(await classifyIntent(input, deps), input, deps)
    }

    return routeClassifiedIntent(intentResult, input, deps)
}

async function routeClassifiedIntent(
    intentResult: ParseCommandResult,
    input: ParseCommandInput,
    deps: ParseCommandDeps
): Promise<ParseCommandWithEnrichReasoningResult> {
    if (intentResult.type === 'Command') {
        // Iteration 7, Sub-iteration 2: classify decides only realness/shape --
        // Plan-stage dispatch now covers every command family, not just object
        // manipulation. Zero-referent paraphrases (LookRoom/Help/Home/AwaitRoadRunner)
        // and Navigation paraphrases resolve deterministically before Parse ever runs
        // (zero Bedrock cost); AcmeOrder resolves after Parse, once planSkeleton
        // has ruled out membership/relational. See AGENT.classifyPlanGeneralization.planning.md,
        // Sub-iteration 2.
        const nonObjectManipulationMatch = matchNonObjectManipulationTemplate(input.command)
        if (nonObjectManipulationMatch.type === 'matched') {
            return answer(nonObjectManipulationMatch.intent)
        }

        const navigationMatch = matchNavigationParaphrase(input)
        if (navigationMatch) {
            return answer(navigationMatch)
        }

        const parseResult = await runParseStage(
            { command: input.command },
            { invokeBedrockObjectManipulationParseImpl: deps.invokeBedrockObjectManipulationParseImpl }
        )
        if (parseResult.type !== 'success') {
            return answer({ type: 'Error', errorMessage: parseResult.errorMessage })
        }

        const plan = planSkeleton(parseResult.tokens, input.command)

        // Plan's attempts all go to one producer. An Abstain from it climbs to Acme, as zero attempts
        // (the non-object families' case) does; with no Acme match, it is the top rung's Abstain.
        const compiled = plan.fills.length > 0
            ? await compileAttemptsFromSkeleton(
                {
                    command: input.command,
                    fills: plan.fills,
                    characterId: input.characterId,
                    hostRoomId: input.hostRoomId,
                    roomObjectCatalog: input.roomObjectCatalog,
                    heldInventoryCatalog: input.heldInventoryCatalog,
                },
                intentResult.confidence,
                {
                    embedSpan: deps.embedSpan,
                    positionsReadDeps: deps.objectManipulationPositionsReadDeps,
                }
            )
            : undefined
        if (compiled !== undefined && compiled.type !== 'Abstain') {
            return answer(compiled)
        }

        const acmeOrderMatch = await matchAcmeOrderFamily(
            parseResult.tokens,
            input,
            intentResult.confidence,
            {
                invokeBedrockAcmeOrderEnrichImpl: deps.invokeBedrockAcmeOrderEnrichImpl,
                countCoyotePlacedObjectsAcrossRoomsDeps: deps.countCoyotePlacedObjectsAcrossRoomsDeps,
            }
        )
        if (acmeOrderMatch) {
            return answer(acmeOrderMatch)
        }

        return answer(compiled ?? { type: 'Unimplemented', confidence: intentResult.confidence })
    }

    if (intentResult.type === 'WorldQuestion') {
        // Iteration 7, Sub-iteration 1: every WorldQuestion routes to PredictHypothesis
        // handling -- accepted regression (a genuinely different world question is
        // mis-routed) until Sub-iteration 3 builds real question-plan dispatch.
        return answer({ type: 'PredictHypothesis', confidence: intentResult.confidence })
    }

    // Error / Unknown / PromptInjectionAttempt / MultipleCommands: no enrich, pass through.
    return answer(intentResult)
}

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **`/test parse`** returns **`ObjectManipulationParseTest`**; **bare `look` / `l`** returns **`LookRoom`**; **bare `help`** returns **`Help`**; **bare `home`** returns **`Home`**; minimal-verb **`take` / `drop` / `get <object>`** is the take/get/drop fast path (the command's tokens, read by Plan and compiled like a parsed command): all without Bedrock classify. A fast-path **`Abstain`** (not understood) climbs to the classify below, and an **`Abstain`** from the LLM route's compile climbs to Acme; only the top rung's Abstain is returned.
 * Otherwise runs the narrowed (iteration 7) intent discrimination: **`Command`** first tries
 * deterministic Plan-stage dispatch (Sub-iteration 2) -- a closed paraphrase lexicon for
 * **`LookRoom`**, **`Help`**, **`Home`**, and **`AwaitRoadRunner`**, then a movement-verb paraphrase
 * matcher for **`Navigation`**, both zero-Bedrock -- before running Parse and dispatching to
 * object manipulation's membership/relational enrich, or (on no family match) an **`AcmeOrder`**
 * paraphrase matcher (Bedrock via `enrichAcmeOrder`), or finally **`Unimplemented`**;
 * **`WorldQuestion`** routes to **`PredictHypothesis`** handling. **`PromptInjectionAttempt`**,
 * **`Unknown`**, **`MultipleCommands`**, and other terminal outcomes pass through without enrich.
 * Enrich chain-of-reason Markdown is not attached to any result from this path; use
 * {@link parseCommandWithEnrichReasoning} when needed (e.g. affinities harness, which calls
 * `enrichAcmeOrder` directly rather than through classify).
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
