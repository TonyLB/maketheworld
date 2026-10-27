import type { ParseCommandAbstainResult, ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandLookRoomResult } from './baseClasses'
import { classifyIntent, discriminateIntent } from './discriminateIntent'
export { navigationIntentErrorMessages } from './discriminateIntent/exitResolution'
export { objectManipulationErrorMessages } from './enrich/objectManipulation/resolveObjectSpan'
import { compileAttemptsFromSkeleton } from './enrich/objectManipulation/compileAttemptsFromSkeleton'
import { planTokens } from './enrich/objectManipulation/plan/planSkeleton'
import { matchAcmeOrderFamily } from './plan/matchAcmeOrderFamily'
import { isBareExitFill } from './enrich/objectManipulation/plan/matchNavigationTemplate'

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
        // Only reachable via deterministicIntentChecks's fast path, which claims every command one of
        // Plan's templates fits. Plan reads every template over the command's tokens; each
        // segmentation its readings make is a fill. This is the one route into Plan.
        const fills = planTokens(intentResult.tokens, input.command, deps.templates)
        // Zero attempts is not understood on this rung, like an Abstain: both climb to classify.
        const compiled = fills.length > 0
            ? await compileAttemptsFromSkeleton(
                {
                    command: input.command,
                    fills,
                    characterId: input.characterId,
                    hostRoomId: input.hostRoomId,
                    roomObjectCatalog: input.roomObjectCatalog,
                    heldInventoryCatalog: input.heldInventoryCatalog,
                    roomExits: input.roomExits,
                },
                intentResult.confidence,
                {
                    positionsReadDeps: deps.objectManipulationPositionsReadDeps,
                }
            )
            : undefined
        if (compiled !== undefined && compiled.type !== 'Abstain') {
            return answer(compiled)
        }
        // Unless no template but the bare exit reading (which fits every command) read it, the
        // fast path's Abstain is the one a `Command` with no Acme match ends at; otherwise the
        // command is one no template implements.
        const readByATemplate = fills.some((fill) => !isBareExitFill(fill))
        return routeClassifiedIntent(await classifyIntent(input, deps), input, deps, readByATemplate ? compiled : undefined)
    }

    return routeClassifiedIntent(intentResult, input, deps)
}

async function routeClassifiedIntent(
    intentResult: ParseCommandResult,
    input: ParseCommandInput,
    deps: ParseCommandDeps,
    planAbstain?: ParseCommandAbstainResult
): Promise<ParseCommandWithEnrichReasoningResult> {
    if (intentResult.type === 'Command') {
        // Classify decides only realness and shape. The intent rows and Plan's templates already ran
        // before classify (`deterministicIntentChecks`), over this same text; AcmeOrder, whose verbs
        // no template reads, runs once Plan's attempts are ruled out.
        const acmeOrderMatch = await matchAcmeOrderFamily(
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

        return answer(planAbstain ? { ...planAbstain, confidence: intentResult.confidence } : { type: 'Unimplemented', confidence: intentResult.confidence })
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
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **`/test parse`** returns **`ObjectManipulationParseTest`**; the intent rows (`deterministicTemplate/intentTemplates.ts`: **`look` / `l`**, **`help`** and **`home`** and their paraphrases, **`predict`**, **`wait`** and its paraphrases) return their results; every other command one of Plan's templates fits (the object templates, a movement verb and an exit, a bare exit name: since that last fits any command, all of them) is the fast path (the command's tokens, read by Plan and compiled), the one route into Plan: all without Bedrock classify. A navigation answers as a **`CommandAttempt`** of kind `navigation`. A fast-path **`Abstain`** (not understood) climbs to the classify below; only the top rung's Abstain is returned.
 * Otherwise runs the narrowed (iteration 7) intent discrimination: **`Command`** tries the **`AcmeOrder`**
 * matcher (Bedrock via `enrichAcmeOrder`), then ends at the fast path's **`Abstain`** if a template
 * read the command, or **`Unimplemented`** if none did;
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
 * Same pipeline as **`parseCommand`** (including the intent rows, Coyote test shortcuts without Bedrock, and intent terminals like **`PromptInjectionAttempt`** without Acme enrich), plus Acme order enrich **`enrichReasoningMarkdown`** for manual review (affinities harness). Does not add that string to **`AcmeOrder`**.
 */
export async function parseCommandWithEnrichReasoning(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    return parseCommandCore(input, deps)
}
