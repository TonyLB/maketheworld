//
// The judge probe's proposals: for each asked request, what its fixture's `proposal` comes to, built before any Bedrock call. A fixture is
// the stand-in supplier here: the dry run and the render it calls are what a template or a proposer would call. Each request reports what
// it was shown, with a hash, since the same fixture and prompt can render differently after a kernel change.
//
import { renderProposedOutcome, PROPOSED_OUTCOME_AFTERS, PROPOSED_OUTCOME_FORMS, type ProposedOutcomeAfter, type ProposedOutcomeForm } from '../../dataSource/actions/sceneProse/renderProposedOutcome'
import { PROPOSED_OUTCOME_EXPLANATION, PROPOSED_OUTCOME_FRAMING, proposedOutcomeBlock } from '../../dataSource/actions/sceneProse/frame'
import { buildSceneFixture, type JudgeRequest, type SceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneHandleTable, SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { EphemeraLudicGraph } from '../../dataSource/positions/ludicGraph'
import { dryRunProposedMoves, type ProposedMove } from '../../dataSource/positions/manipulation/proposedMoves'
import { textHash } from '../textHash'

export type ProposedOutcomeOptions = {
    form: ProposedOutcomeForm
    after: ProposedOutcomeAfter
    framing: string
    explanation: string
    explanationOverridden: boolean
}

export type ProposedOutcomeShown =
    | { status: 'none' }
    | { status: 'refused'; reason: string }
    | { status: 'shown'; text: string }

const MAX_TEXT_CHARS = 2_000

const isShortText = (text: unknown): text is string => typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_TEXT_CHARS

/** The event's `proposedOutcome` with its defaults filled in, or the reason it is refused. */
export const parseProposedOutcomeOptions = (value: unknown): ProposedOutcomeOptions | string => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return 'proposedOutcome must be an object of { form?, after?, framing?, explanation? }'
    }
    const { form = 'after', after = 'fiction', framing = PROPOSED_OUTCOME_FRAMING, explanation } = value as Record<string, unknown>
    if (!PROPOSED_OUTCOME_FORMS.includes(form as ProposedOutcomeForm)) {
        return `proposedOutcome.form must be one of: ${PROPOSED_OUTCOME_FORMS.join(', ')}`
    }
    if (!PROPOSED_OUTCOME_AFTERS.includes(after as ProposedOutcomeAfter)) {
        return `proposedOutcome.after must be one of: ${PROPOSED_OUTCOME_AFTERS.join(', ')}`
    }
    if (!isShortText(framing)) {
        return `proposedOutcome.framing must be a non-empty string of at most ${MAX_TEXT_CHARS} characters`
    }
    if (explanation !== undefined && !isShortText(explanation)) {
        return `proposedOutcome.explanation must be a non-empty string of at most ${MAX_TEXT_CHARS} characters`
    }
    return {
        form: form as ProposedOutcomeForm,
        after: after as ProposedOutcomeAfter,
        framing,
        explanation: explanation ?? PROPOSED_OUTCOME_EXPLANATION,
        explanationOverridden: explanation !== undefined,
    }
}

export type ProposalAfter =
    | { status: 'refused'; reason: string }
    | { status: 'legal'; moves: readonly ProposedMove[]; scene: SceneModel }

/** A proposal's dry run over the fixture's graphs, and the scene after it, named with the before scene's `handles`. */
export const proposalAfter = async (fixture: SceneFixture, handles: SceneHandleTable, moves: readonly ProposedMove[]): Promise<ProposalAfter> => {
    const graphs = new Map(fixture.graphs.map(([hostId, payload]) => [hostId, EphemeraLudicGraph.fromFieldPayload(hostId, payload)]))
    const outcome = await dryRunProposedMoves(moves, graphs)
    if (outcome.verdict === 'refused') {
        return { status: 'refused', reason: outcome.reason }
    }
    const afterCache = await buildSceneFixture({ ...fixture, graphs: [...outcome.graphs].map(([hostId, graph]) => [hostId, graph.toStored()]) })
    return { status: 'legal', moves: outcome.moves, scene: afterCache.scene({ exits: fixture.exits, handleSeed: handles }).scene }
}

export const proposedOutcomesFor = async (
    fixture: SceneFixture,
    requests: readonly (readonly [number, JudgeRequest])[],
    { form, after, framing, explanation }: ProposedOutcomeOptions
): Promise<ReadonlyMap<number, ProposedOutcomeShown>> => {
    const { handles } = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits })
    return new Map(await Promise.all(requests.map(async ([index, { proposal }]): Promise<[number, ProposedOutcomeShown]> => {
        if (proposal === undefined) {
            return [index, { status: 'none' }]
        }
        const outcome = await proposalAfter(fixture, handles, proposal)
        if (outcome.status === 'refused') {
            return [index, outcome]
        }
        const body = renderProposedOutcome({ moves: outcome.moves, handles, scene: outcome.scene, form, after })
        return [index, { status: 'shown', text: proposedOutcomeBlock({ body, framing, explanation }) }]
    })))
}

/** What the probe's result says about proposals: the settings, and for each asked request what it was shown. */
export const proposedOutcomeReport = ({ form, after, framing, explanation, explanationOverridden }: ProposedOutcomeOptions, shown: ReadonlyMap<number, ProposedOutcomeShown>) => ({
    form,
    after,
    framing,
    explanation: { hash: textHash(explanation), overridden: explanationOverridden },
    requests: [...shown].map(([request, outcome]) => ({
        request,
        ...outcome,
        ...(outcome.status === 'shown' ? { hash: textHash(outcome.text) } : {}),
    })),
})
