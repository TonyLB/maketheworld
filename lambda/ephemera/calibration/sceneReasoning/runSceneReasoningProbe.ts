//
// The scene-reasoning probe's runner (sceneProjection SP-8): the scene rendered once per format, then one Bedrock call per
// (format, question, repeat), each a single prompt with no follow-up turn. The format axis came back when SP-7 was reopened
// (D against `fans`, 2026-11-03). The Bedrock call is injected, so tests never reach Bedrock.
//
import type { SceneModel } from '../../dataSource/positions/ludicCache/sceneModel'
import { expectedAnswer, type SceneQuestion } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { renderScene, type SceneFormat } from '../../dataSource/actions/sceneProse'
import { invokeBedrockConverseText, type InvokeBedrockConverseTextResult } from '../../llm/invokeBedrockConverseText'
import { novaModelToBedrockModelId, type NovaModel } from '../../llm/novaModel'
import { probePrompt, questionText } from './sceneReasoningPrompt'
import { expectedTokens, scoreReply } from './sceneReasoningScore'

/** A hard limit on formats x questions x repeats per invoke, refused before any call when exceeded. */
export const PROBE_CALL_CAP = 12
/** Not repeatable: at 0.1 Nova Micro's repeats of one open question split yes and no (2026-11-03). */
export const PROBE_TEMPERATURE = 0.1
export const PROBE_MAX_TOKENS = 256
/** An `open` answer explains and lists changes, so it gets more room. */
export const PROBE_OPEN_MAX_TOKENS = 1024
/** Calls run concurrently, so a full batch fits the Lambda timeout. */
export const PROBE_TIMEOUT_MS = 15_000

export type ProbeInvoke = (params: Parameters<typeof invokeBedrockConverseText>[0]) => Promise<InvokeBedrockConverseTextResult>

export type ProbeCallResult = {
    format: SceneFormat
    question: SceneQuestion
    questionText: string
    repeat: number
    scene: string
    answer?: string
    /** The expected answer, as the fixture computes it; absent for a `characterId` scene and an `open` question (whose rubric rides on `question`). */
    expected?: ReturnType<typeof expectedAnswer>
    /** A reading aid only: whether the reply's tokens equal the expected ones. Absent when unscored. */
    matches?: boolean
    usage?: unknown
    error?: string
}

export const runSceneReasoningProbe = async ({ scene, formats, questions, repeats, model, expectAnswers, invoke = invokeBedrockConverseText }: {
    scene: SceneModel
    formats: readonly SceneFormat[]
    questions: readonly SceneQuestion[]
    repeats: number
    model: NovaModel
    expectAnswers: boolean
    invoke?: ProbeInvoke
}): Promise<ProbeCallResult[]> => {
    const rendered = Object.fromEntries(formats.map((format) => [format, renderScene(scene, format)])) as Record<SceneFormat, string>
    const calls = formats.flatMap((format) => questions.flatMap((question) => (
        Array.from({ length: repeats }, (_, repeat) => ({ format, question, repeat: repeat + 1 }))
    )))
    return Promise.all(calls.map(async ({ format, question, repeat }): Promise<ProbeCallResult> => {
        const base = { format, question, questionText: questionText(question), repeat, scene: rendered[format] }
        const result = await invoke({
            modelId: novaModelToBedrockModelId(model),
            messages: [{ role: 'user', content: [{ text: probePrompt(rendered[format], question) }] }],
            maxTokens: question.type === 'open' ? PROBE_OPEN_MAX_TOKENS : PROBE_MAX_TOKENS,
            temperature: PROBE_TEMPERATURE,
            timeoutMs: PROBE_TIMEOUT_MS,
        })
        if (!result.success) {
            return { ...base, error: result.errorMessage }
        }
        const expected = expectAnswers ? expectedAnswer(scene, question) : undefined
        const matches = expected === undefined ? undefined : scoreReply(expectedTokens(expected), result.body)
        return {
            ...base,
            answer: result.body,
            ...(expected !== undefined ? { expected } : {}),
            ...(matches !== undefined ? { matches } : {}),
            ...(result.usage !== undefined ? { usage: result.usage } : {}),
        }
    }))
}
