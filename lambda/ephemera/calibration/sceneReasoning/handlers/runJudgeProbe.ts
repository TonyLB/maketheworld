import { calibrationJsonResponse } from '../../calibrationResponse'
import { buildSceneFixture, sceneFixture, sceneFixtureNames } from '../../../dataSource/positions/ludicCache/sceneFixtures'
import { renderScene } from '../../../dataSource/actions/sceneProse'
import { JUDGE_INSTRUCTIONS, withJudgeRecap } from '../../../dataSource/actions/sceneProse/frame'
import { isNovaModel, type NovaModel } from '../../../llm/novaModel'
import { PROBE_CALL_CAP, PROBE_TEMPERATURE, type ProbeInvoke } from '../runSceneReasoningProbe'
import { runJudgeProbe, textHash } from '../runJudgeProbe'
import { judgeReplySteps, summarizeJudge } from '../judgeGrade'
import { parseProposedOutcomeOptions, proposedOutcomeReport, proposedOutcomesFor, type ProposedOutcomeShown } from '../proposedOutcomeBlocks'

export type JudgeProbeEvent = {
    type: 'JudgeProbe'
    scene?: { fixture?: unknown }
    /** The fixture's request set; default `judge`. */
    set?: unknown
    /** Indices into the set to ask, in place of all of it (to fit the cap, or to rerun the ones that failed). */
    only?: unknown
    repeats?: unknown
    model?: unknown
    /** A draft of the judge's instructions, for this invoke only: the deployed text is untouched. */
    instructions?: unknown
    /** A draft of the scene text, in place of the render, for this invoke only: with `instructions`, the whole prompt but its `Request` line. */
    sceneText?: unknown
    /** Adds the recap to the instructions in use, built or draft, for reading: a run with it on is not a score. */
    development?: unknown
    /** Shows each asked request that holds a `proposal` its proposed outcome: `{ form?, after?, framing?, explanation? }`, all optional. */
    proposedOutcome?: unknown
}

export type JudgeProbeDeps = { invoke?: ProbeInvoke }

/** The longest draft accepted of either text: the deployed instructions are about 9,000 characters. */
const MAX_DRAFT_CHARS = 20_000

const isDraftText = (text: unknown): text is string => typeof text === 'string' && text.trim().length > 0 && text.length <= MAX_DRAFT_CHARS

const refuse = (error: string) => calibrationJsonResponse(400, { error })

/**
 * The judge prompt against a fixture's request set: one Bedrock call per (request, repeat), graded by label, with the tally and
 * every reply returned. Every refusal happens before the first call.
 */
export async function handleJudgeProbe(event: JudgeProbeEvent, deps: JudgeProbeDeps = {}) {
    const fixtureName = event.scene?.fixture
    if (typeof fixtureName !== 'string' || !sceneFixtureNames.includes(fixtureName)) {
        return refuse(`scene must be { "fixture": name } with name one of: ${sceneFixtureNames.join(', ')}`)
    }
    const fixture = sceneFixture(fixtureName)
    const setName = event.set === undefined ? 'judge' : event.set
    const sets = fixture.judgeSets ?? {}
    if (typeof setName !== 'string' || sets[setName] === undefined) {
        return refuse(`fixture ${fixtureName} has no request set ${JSON.stringify(setName)}; it has: ${Object.keys(sets).join(', ') || '(none)'}`)
    }
    const set = sets[setName]

    let indices = set.map((_, index) => index)
    if (event.only !== undefined) {
        if (!Array.isArray(event.only) || event.only.length === 0 || !event.only.every((index) => Number.isInteger(index) && index >= 0 && index < set.length)) {
            return refuse(`only must be a non-empty list of indices from 0 to ${set.length - 1}`)
        }
        indices = [...new Set<number>(event.only)]
    }
    const repeats = event.repeats === undefined ? 1 : event.repeats
    if (typeof repeats !== 'number' || !Number.isInteger(repeats) || repeats < 1) {
        return refuse('repeats must be an integer of at least 1')
    }
    if (indices.length * repeats > PROBE_CALL_CAP) {
        return refuse(`${indices.length} requests x ${repeats} repeats = ${indices.length * repeats} calls, over the cap of ${PROBE_CALL_CAP}; trim requests (only) or repeats`)
    }
    const model: NovaModel = event.model === undefined ? 'NovaMicro' : event.model as NovaModel
    if (!isNovaModel(model)) {
        return refuse('model must be a NovaModel (NovaMicro or Nova2Lite)')
    }
    if (event.instructions !== undefined && !isDraftText(event.instructions)) {
        return refuse(`instructions must be a non-empty string of at most ${MAX_DRAFT_CHARS} characters`)
    }
    if (event.development !== undefined && typeof event.development !== 'boolean') {
        return refuse('development must be a boolean')
    }
    const baseInstructions = event.instructions ?? JUDGE_INSTRUCTIONS
    const instructions = event.development === true ? withJudgeRecap(baseInstructions) : baseInstructions
    if (judgeReplySteps(instructions).slice(-1)[0] !== 'answer') {
        return refuse('instructions must number the steps of the reply, ending in Answer, for the reply to be graded')
    }
    if (event.sceneText !== undefined && !isDraftText(event.sceneText)) {
        return refuse(`sceneText must be a non-empty string of at most ${MAX_DRAFT_CHARS} characters`)
    }
    if (event.sceneText !== undefined) {
        const draftScene = event.sceneText
        const absent = indices.flatMap((index) => set[index].request.match(/\[[^\]]+\]/g) ?? []).filter((handle) => !draftScene.includes(handle))
        if (absent.length > 0) {
            return refuse(`sceneText does not name what the requests ask about: ${[...new Set(absent)].join(', ')}`)
        }
    }
    const proposedOptions = event.proposedOutcome === undefined ? undefined : parseProposedOutcomeOptions(event.proposedOutcome)
    if (typeof proposedOptions === 'string') {
        return refuse(proposedOptions)
    }
    const sceneText = event.sceneText ?? renderScene((await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene, 'judge')
    const shown: ReadonlyMap<number, ProposedOutcomeShown> = proposedOptions === undefined
        ? new Map()
        : await proposedOutcomesFor(fixture, indices.map((index) => [index, set[index]] as const), proposedOptions)
    // A refused proposal stops here: production would never send it, so the report says why and Micro is not called.
    const calls = await runJudgeProbe({
        sceneText,
        requests: indices.flatMap((index) => {
            const outcome = shown.get(index)
            return outcome?.status === 'refused' ? [] : [{ index, request: set[index], ...(outcome?.status === 'shown' ? { proposedOutcome: outcome.text } : {}) }]
        }),
        repeats,
        model,
        instructions,
        ...(deps.invoke !== undefined ? { invoke: deps.invoke } : {}),
    })
    return calibrationJsonResponse(200, {
        model,
        temperature: PROBE_TEMPERATURE,
        fixture: fixtureName,
        set: setName,
        repeats,
        instructions: { hash: textHash(instructions), chars: instructions.length, overridden: event.instructions !== undefined, development: event.development === true },
        sceneText: { hash: textHash(sceneText), chars: sceneText.length, overridden: event.sceneText !== undefined },
        ...(proposedOptions === undefined ? {} : { proposedOutcome: proposedOutcomeReport(proposedOptions, shown) }),
        summary: summarizeJudge(set, calls),
        read: calls,
    })
}
