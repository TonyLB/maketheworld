import { calibrationJsonResponse } from '../calibrationResponse'
import { buildSceneFixture, sceneFixture } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { renderSceneJudge } from '../../dataSource/actions/sceneProse/renderSceneJudge'
import { JUDGE_RULES_WORDINGS, type JudgeRulesWording } from '../../dataSource/actions/sceneProse/sceneRules'
import { composeJudgePrompt, withJudgeRecap } from '../../dataSource/actions/sceneProse/frame'
import { PROPOSED_OUTCOME_AFTERS } from '../../dataSource/actions/sceneProse/renderProposedOutcome'
import { isNovaModel, type NovaModel } from '../../llm/novaModel'
import { judgeReplySteps } from '../sceneReasoning/judgeGrade'
import { MAX_DRAFT_CHARS, isDraftText } from '../sceneReasoning/handlers/runJudgeProbe'
import { textHash } from '../textHash'
import { PROBE_CALL_CAP, PROBE_TEMPERATURE, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'
import { oracleCaseIds, oracleCases } from './oracleCases'
import { ORACLE_FRAMING, ORACLE_FRAMING_KEYS, ORACLE_SHOW, renderOracleInputs, type OracleFraming, type OracleShow } from './renderOracleInputs'
import { runOracleProbe, summarizeOracle } from './runOracleProbe'

export type OracleProbeEvent = {
    type: 'OracleProbe'
    /** Corpus case IDs (`OC-6`, `OC-30/2`): each its own scene, request and oracle inputs. */
    cases?: unknown
    /** The draft's instructions. There is no built oracle prompt, so a draft is required. */
    instructions?: unknown
    repeats?: unknown
    model?: unknown
    /** Adds the recap to the draft, for reading: a run with it on is not one to compare. */
    development?: unknown
    /** Replaces any of the inputs' headings, for this invoke: `{ candidate: 'Candidate', ... }`. */
    framing?: unknown
    /** `{ after?: 'none' | 'fiction' | 'whole', suppliedBy?: boolean }`. */
    show?: unknown
    /** The scene's Rules wording: `v45` (default, the built judge's), `violation` (a test of a method) or `inForce` (in force, voids, blocks). */
    rules?: unknown
}

export type OracleProbeDeps = { invoke?: ProbeInvoke }

const MAX_FRAMING_CHARS = 2_000

const refuse = (error: string) => calibrationJsonResponse(400, { error })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const parseFraming = (value: unknown): OracleFraming | string => {
    if (!isRecord(value)) {
        return `framing must be an object with any of: ${ORACLE_FRAMING_KEYS.join(', ')}`
    }
    const unknownKeys = Object.keys(value).filter((key) => !(ORACLE_FRAMING_KEYS as string[]).includes(key))
    if (unknownKeys.length > 0) {
        return `framing has unknown keys ${unknownKeys.join(', ')}; it takes: ${ORACLE_FRAMING_KEYS.join(', ')}`
    }
    const bad = Object.entries(value).find(([, text]) => typeof text !== 'string' || text.trim().length === 0 || text.length > MAX_FRAMING_CHARS)
    return bad !== undefined
        ? `framing.${bad[0]} must be a non-empty string of at most ${MAX_FRAMING_CHARS} characters`
        : { ...ORACLE_FRAMING, ...(value as Partial<OracleFraming>) }
}

const parseShow = (value: unknown): OracleShow | string => {
    if (!isRecord(value)) {
        return 'show must be an object of { after?, suppliedBy? }'
    }
    const { after = ORACLE_SHOW.after, suppliedBy = ORACLE_SHOW.suppliedBy } = value
    if (after !== 'none' && !(PROPOSED_OUTCOME_AFTERS as readonly unknown[]).includes(after)) {
        return `show.after must be one of: none, ${PROPOSED_OUTCOME_AFTERS.join(', ')}`
    }
    if (typeof suppliedBy !== 'boolean') {
        return 'show.suppliedBy must be a boolean'
    }
    return { after: after as OracleShow['after'], suppliedBy }
}

/**
 * A draft of the oracle against the harness's cases: each case's scene in the judge render, its inputs after `End of scene.`, then its
 * request. One Bedrock call per (case, repeat), every reply returned with its form. Every refusal happens before the first call.
 */
export async function handleOracleProbe(event: OracleProbeEvent, deps: OracleProbeDeps = {}) {
    const { cases } = event
    if (!Array.isArray(cases) || cases.length === 0 || !cases.every((id) => typeof id === 'string' && oracleCaseIds.includes(id))) {
        return refuse(`cases must be a non-empty list of case IDs from: ${oracleCaseIds.join(', ')}`)
    }
    const caseIds = [...new Set<string>(cases)]
    const repeats = event.repeats === undefined ? 1 : event.repeats
    if (typeof repeats !== 'number' || !Number.isInteger(repeats) || repeats < 1) {
        return refuse('repeats must be an integer of at least 1')
    }
    if (caseIds.length * repeats > PROBE_CALL_CAP) {
        return refuse(`${caseIds.length} cases x ${repeats} repeats = ${caseIds.length * repeats} calls, over the cap of ${PROBE_CALL_CAP}; trim cases or repeats`)
    }
    const model: NovaModel = event.model === undefined ? 'NovaMicro' : event.model as NovaModel
    if (!isNovaModel(model)) {
        return refuse('model must be a NovaModel (NovaMicro or Nova2Lite)')
    }
    if (!isDraftText(event.instructions)) {
        return refuse(`instructions must be a draft: a non-empty string of at most ${MAX_DRAFT_CHARS} characters`)
    }
    if (event.development !== undefined && typeof event.development !== 'boolean') {
        return refuse('development must be a boolean')
    }
    const instructions = event.development === true ? withJudgeRecap(event.instructions) : event.instructions
    const steps = judgeReplySteps(instructions)
    if (steps.slice(-1)[0] !== 'answer') {
        return refuse('instructions must number the steps of the reply, ending in Answer, for the reply\'s form to be checked')
    }
    const framing = event.framing === undefined ? ORACLE_FRAMING : parseFraming(event.framing)
    if (typeof framing === 'string') {
        return refuse(framing)
    }
    const show = event.show === undefined ? ORACLE_SHOW : parseShow(event.show)
    if (typeof show === 'string') {
        return refuse(show)
    }
    const rules = event.rules === undefined ? 'v45' : event.rules
    if (!(JUDGE_RULES_WORDINGS as readonly unknown[]).includes(rules)) {
        return refuse(`rules must be one of: ${JUDGE_RULES_WORDINGS.join(', ')}`)
    }
    const rulesWording = rules as JudgeRulesWording

    const prepared = await Promise.all(caseIds.map(async (caseId) => {
        const oracleCase = oracleCases[caseId]
        const fixture = sceneFixture(oracleCase.scene.fixture)
        const sceneText = renderSceneJudge((await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene, rulesWording)
        return { caseId, oracleCase, sceneText, inputs: await renderOracleInputs(fixture, oracleCase, { framing, show, rules: rulesWording }) }
    }))
    const refusedCase = prepared.find(({ inputs }) => inputs.status === 'refused')
    if (refusedCase !== undefined && refusedCase.inputs.status === 'refused') {
        return refuse(`case ${refusedCase.caseId}: the dry run refuses candidate ${refusedCase.inputs.candidateId} (${refusedCase.inputs.reason}), a case-data error`)
    }
    const absent = prepared.flatMap(({ caseId, oracleCase, sceneText }) => (
        (oracleCase.request.match(/\[[^\]]+\]/g) ?? []).filter((handle) => !sceneText.includes(handle)).map((handle) => `${caseId} ${handle}`)
    ))
    if (absent.length > 0) {
        return refuse(`the scene does not name what the requests ask about: ${absent.join(', ')}`)
    }
    const rendered = prepared.map(({ caseId, oracleCase, sceneText, inputs }) => ({
        caseId, oracleCase, sceneText, text: inputs.status === 'rendered' ? inputs.text : '',
    }))
    const calls = await runOracleProbe({
        prompts: rendered.map(({ caseId, oracleCase, sceneText, text }) => ({
            caseId,
            prompt: composeJudgePrompt({ sceneText, request: oracleCase.request, instructions, proposedOutcome: text }),
        })),
        steps,
        repeats,
        model,
        ...(deps.invoke !== undefined ? { invoke: deps.invoke } : {}),
    })
    return calibrationJsonResponse(200, {
        model,
        temperature: PROBE_TEMPERATURE,
        repeats,
        instructions: { hash: textHash(instructions), chars: instructions.length, development: event.development === true },
        framing: { overridden: event.framing === undefined ? [] : Object.keys(event.framing as object) },
        show,
        rules: rulesWording,
        cases: rendered.map(({ caseId, oracleCase, sceneText, text }) => ({
            case: caseId,
            fixture: oracleCase.scene.fixture,
            request: oracleCase.request,
            endResult: oracleCase.endResult,
            ...(oracleCase.note === undefined ? {} : { note: oracleCase.note }),
            sceneText: { hash: textHash(sceneText), chars: sceneText.length },
            inputs: { hash: textHash(text), text },
        })),
        summary: summarizeOracle(calls),
        read: calls,
    })
}
