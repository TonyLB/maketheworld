import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandLookRoomResult } from './baseClasses'
import { discriminateIntent } from './discriminateIntent'
export { navigationIntentErrorMessages } from './discriminateIntent/exitResolution'
export { objectManipulationErrorMessages } from './enrich/objectManipulation/resolveObjectSpan'
import { compileAttemptsFromSkeleton } from './enrich/objectManipulation/compileAttemptsFromSkeleton'
import { runParseStage } from './enrich/objectManipulation/parse/runParseStage'
import { stampStableRefKeys } from './enrich/objectManipulation/parse/stampStableRefKeys'
import { planSkeleton } from './enrich/objectManipulation/plan/planSkeleton'
import { matchNonObjectManipulationTemplate } from './deterministicTemplate'
import { matchNavigationParaphrase } from './plan/matchNavigationParaphrase'
import { matchAcmeOrderFamily } from './plan/matchAcmeOrderFamily'

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
        // Only reachable via deterministicIntentChecks's take/get/drop fast path (iteration 7,
        // Sub-iteration 1). ISS8203 slice 3: the fast path synthesizes its skeleton, the
        // leading verb and its one object span, stamps it, and enters Plan like a parsed skeleton.
        const verb = input.command.trim().split(/\s+/)[0]!
        const skeleton = stampStableRefKeys([
            { type: 'text', text: verb },
            { type: 'objectSpan', span: intentResult.rawObjectSpans[0]! },
        ])
        const plan = planSkeleton(skeleton, input.command)
        if (plan.type === 'declined') {
            return { result: { type: 'Error', errorMessage: plan.errorMessage }, enrichReasoningMarkdown: '', enrichRawBody: undefined }
        }
        if (plan.attempts.length === 0) {
            return { result: { type: 'Unimplemented', confidence: intentResult.confidence }, enrichReasoningMarkdown: '', enrichRawBody: undefined }
        }
        const result = await compileAttemptsFromSkeleton(
            {
                command: input.command,
                skeleton,
                attempts: plan.attempts,
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
        return { result, enrichReasoningMarkdown: '', enrichRawBody: undefined }
    }

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
            return {
                result: nonObjectManipulationMatch.intent,
                enrichReasoningMarkdown: '',
                enrichRawBody: undefined,
            }
        }

        const navigationMatch = matchNavigationParaphrase(input)
        if (navigationMatch) {
            return { result: navigationMatch, enrichReasoningMarkdown: '', enrichRawBody: undefined }
        }

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

        const plan = planSkeleton(parseResult.tokens, input.command)
        if (plan.type === 'declined') {
            return {
                result: { type: 'Error', errorMessage: plan.errorMessage },
                enrichReasoningMarkdown: '',
                enrichRawBody: undefined,
            }
        }

        // Plan's attempts all go to one producer. Zero attempts is the non-object families' case (Acme, then Unimplemented).
        if (plan.attempts.length > 0) {
            const result = await compileAttemptsFromSkeleton(
                {
                    command: input.command,
                    skeleton: parseResult.tokens,
                    attempts: plan.attempts,
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
            return { result, enrichReasoningMarkdown: '', enrichRawBody: undefined }
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
            return { result: acmeOrderMatch, enrichReasoningMarkdown: '', enrichRawBody: undefined }
        }

        return {
            result: { type: 'Unimplemented', confidence: intentResult.confidence },
            enrichReasoningMarkdown: '',
            enrichRawBody: undefined,
        }
    }

    if (intentResult.type === 'WorldQuestion') {
        // Iteration 7, Sub-iteration 1: every WorldQuestion routes to PredictHypothesis
        // handling -- accepted regression (a genuinely different world question is
        // mis-routed) until Sub-iteration 3 builds real question-plan dispatch.
        return {
            result: { type: 'PredictHypothesis', confidence: intentResult.confidence },
            enrichReasoningMarkdown: '',
            enrichRawBody: undefined,
        }
    }

    // Error / Unknown / PromptInjectionAttempt / MultipleCommands: no enrich, pass through.
    return { result: intentResult, enrichReasoningMarkdown: '', enrichRawBody: undefined }
}

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **bare `look` / `l`** returns **`LookRoom`**; **bare `help`** returns **`Help`**; **bare `home`** returns **`Home`**; minimal-verb **`take` / `drop` / `get <object>`** returns **`ObjectMembershipIntent`**: all without Bedrock classify.
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
