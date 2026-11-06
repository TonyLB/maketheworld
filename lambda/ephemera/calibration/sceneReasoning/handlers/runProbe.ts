import { calibrationJsonResponse } from '../../calibrationResponse'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { buildSceneFixture, sceneFixture, sceneFixtureNames, type SceneQuestion } from '../../../dataSource/positions/ludicCache/sceneFixtures'
import type { SceneModel } from '../../../dataSource/positions/ludicCache/sceneModel'
import { defaultSceneFormats, isSceneFormat, sceneFormats, type SceneFormat } from '../../../dataSource/actions/sceneProse'
import { getActorCache } from '../../../dataSource/actions/actorObjectCatalog'
import { answerFormats, defaultAnswerFormat, isAnswerFormat, isJudgeLabel, isTriageLabel, type AnswerFormat } from '../../../dataSource/actions/sceneProse/frame'
import { questionText } from '../sceneReasoningPrompt'
import { isNovaModel, type NovaModel } from '../../../llm/novaModel'
import { PROBE_CALL_CAP, runSceneReasoningProbe, type ProbeCallResult, type ProbeInvoke } from '../runSceneReasoningProbe'

export type SceneReasoningProbeEvent = {
    type: 'SceneReasoningProbe'
    scene?: { fixture?: unknown; characterId?: unknown }
    formats?: unknown
    /** How `open` questions are asked to answer (`abstain`, `twoRegisters`, `triageLabel`, `triageReason`, `triageWhyImpossible`, `triageLegacy`, `judge`); default `twoRegisters`. */
    answerFormats?: unknown
    questions?: unknown
    repeats?: unknown
    model?: unknown
    /** Return only what is needed to grade: each question's wording once, and per call its format, question index, answer and token counts. */
    brief?: unknown
}

export type SceneReasoningProbeDeps = {
    invoke?: ProbeInvoke
    /** A live character's actor cache (reads only); `undefined` when the character is in no room. */
    getActorCache?: typeof getActorCache
}

/** The fields each question type needs, as strings. */
const QUESTION_FIELDS: Record<SceneQuestion['type'], readonly string[]> = {
    directContents: [],
    placedOn: ['subject'],
    chainOut: ['subject'],
    whereIs: ['subject'],
    movesWith: ['subject'],
    held: [],
    relatedTo: ['subject', 'label'],
    relatedFrom: ['target', 'label'],
    securedTo: ['target'],
    associatedWith: ['subject'],
    howMany: ['name'],
    open: ['asked'],
}

/** Optional string fields, checked when present; `triage` must also be a label. */
const OPTIONAL_STRING_FIELDS = ['asked', 'rubric'] as const

const isQuestion = (value: unknown): value is SceneQuestion => {
    if (typeof value !== 'object' || value === null) {
        return false
    }
    const { type } = value as { type?: unknown }
    return typeof type === 'string'
        && Object.prototype.hasOwnProperty.call(QUESTION_FIELDS, type)
        && QUESTION_FIELDS[type as SceneQuestion['type']].every((field) => typeof (value as Record<string, unknown>)[field] === 'string')
        && OPTIONAL_STRING_FIELDS.every((field) => (value as Record<string, unknown>)[field] === undefined || typeof (value as Record<string, unknown>)[field] === 'string')
        && ((value as Record<string, unknown>).triage === undefined || isTriageLabel((value as Record<string, unknown>).triage) || isJudgeLabel((value as Record<string, unknown>).triage))
}

const refuse = (error: string) => calibrationJsonResponse(400, { error })

/** One Bedrock call per (format, question, repeat); every refusal happens before the first call. */
export async function handleSceneReasoningProbe(event: SceneReasoningProbeEvent, deps: SceneReasoningProbeDeps = {}) {
    const { fixture: fixtureName, characterId } = event.scene ?? {}
    if ((fixtureName === undefined) === (characterId === undefined)) {
        return refuse('scene must be exactly one of { "fixture": name } or { "characterId": "CHARACTER#..." }')
    }

    let formats: SceneFormat[] = [...defaultSceneFormats]
    if (event.formats !== undefined) {
        if (!Array.isArray(event.formats) || event.formats.length === 0 || !event.formats.every(isSceneFormat)) {
            return refuse(`formats must be a non-empty list drawn from: ${sceneFormats.join(', ')}`)
        }
        formats = [...new Set<SceneFormat>(event.formats)]
    }

    let answerFormatList: AnswerFormat[] = [defaultAnswerFormat]
    if (event.answerFormats !== undefined) {
        if (!Array.isArray(event.answerFormats) || event.answerFormats.length === 0 || !event.answerFormats.every(isAnswerFormat)) {
            return refuse(`answerFormats must be a non-empty list drawn from: ${answerFormats.join(', ')}`)
        }
        answerFormatList = [...new Set<AnswerFormat>(event.answerFormats)]
    }

    const repeats = event.repeats === undefined ? 1 : event.repeats
    if (typeof repeats !== 'number' || !Number.isInteger(repeats) || repeats < 1) {
        return refuse('repeats must be an integer of at least 1')
    }

    if (event.brief !== undefined && typeof event.brief !== 'boolean') {
        return refuse('brief must be true or false')
    }

    const model: NovaModel = event.model === undefined ? 'NovaMicro' : event.model as NovaModel
    if (!isNovaModel(model)) {
        return refuse('model must be a NovaModel (NovaMicro or Nova2Lite)')
    }

    let customQuestions: SceneQuestion[] | undefined
    if (event.questions !== undefined) {
        if (!Array.isArray(event.questions) || event.questions.length === 0 || !event.questions.every(isQuestion)) {
            return refuse(`questions must be a non-empty list of { type, ...fields }, with type one of: ${Object.keys(QUESTION_FIELDS).join(', ')}`)
        }
        customQuestions = event.questions
    }

    let scene: SceneModel
    let questions: SceneQuestion[]
    if (fixtureName !== undefined) {
        if (typeof fixtureName !== 'string' || !sceneFixtureNames.includes(fixtureName)) {
            return refuse(`unknown scene fixture ${JSON.stringify(fixtureName)}; expected one of: ${sceneFixtureNames.join(', ')}`)
        }
        const fixture = sceneFixture(fixtureName)
        questions = customQuestions ?? fixture.questions
        if (formats.length * answerFormatList.length * questions.length * repeats > PROBE_CALL_CAP) {
            return refuse(callCapMessage(formats.length, answerFormatList.length, questions.length, repeats))
        }
        scene = (await buildSceneFixture(fixture)).scene({ exits: fixture.exits }).scene
    } else {
        if (typeof characterId !== 'string' || !isEphemeraCharacterId(characterId)) {
            return refuse('characterId must be a CHARACTER# id')
        }
        if (customQuestions === undefined) {
            return refuse('a characterId scene has no question set of its own; give questions')
        }
        questions = customQuestions
        if (formats.length * answerFormatList.length * questions.length * repeats > PROBE_CALL_CAP) {
            return refuse(callCapMessage(formats.length, answerFormatList.length, questions.length, repeats))
        }
        const cache = await (deps.getActorCache ?? getActorCache)(characterId)
        if (cache === undefined) {
            return refuse(`${characterId} is in no room, so has no actor cache`)
        }
        // Exits come from the affordance topology as room ids, not names; left out so no id reaches the reader.
        scene = cache.scene().scene
    }

    const results = await runSceneReasoningProbe({
        scene,
        formats,
        answerFormats: answerFormatList,
        questions,
        repeats,
        model,
        expectAnswers: fixtureName !== undefined,
        invoke: deps.invoke,
    })
    return calibrationJsonResponse(200, event.brief === true
        ? { model, calls: results.length, questions: questions.map(questionText), results: results.map((result) => briefResult(questions, result)) }
        : { model, calls: results.length, results })
}

/** A result without the scene, question and rubric it would repeat on every call (`SceneReasoningFixtures` shows the scene). */
const briefResult = (questions: readonly SceneQuestion[], { format, answerFormat, question, repeat, answer, expected, matches, usage, error }: ProbeCallResult) => {
    const { inputTokens, outputTokens } = (usage ?? {}) as { inputTokens?: number; outputTokens?: number }
    return {
        format,
        answerFormat,
        question: questions.indexOf(question),
        repeat,
        ...(answer !== undefined ? { answer } : {}),
        ...(expected !== undefined ? { expected } : {}),
        ...(matches !== undefined ? { matches } : {}),
        ...(inputTokens !== undefined ? { tokens: `${inputTokens} in, ${outputTokens} out` } : {}),
        ...(error !== undefined ? { error } : {}),
    }
}

const callCapMessage = (formats: number, answerFormats: number, questions: number, repeats: number): string => (
    `${formats} formats x ${answerFormats} answer formats x ${questions} questions x ${repeats} repeats = ${formats * answerFormats * questions * repeats} calls, over the cap of ${PROBE_CALL_CAP}; trim formats, answer formats, questions or repeats`
)
