//
// The judge probe's runner: one Bedrock call per (request, repeat), each the whole judge prompt, graded
// by `judgeGrade.ts`. Separate from `runSceneReasoningProbe.ts`: that one varies format x answer format x question, and the judge
// has one prompt, a set of requests with expected labels, and drafts of its text to compare.
//
import { createHash } from 'crypto'
import type { JudgeRequest } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { JUDGE_INSTRUCTIONS, composeJudgePrompt } from '../../dataSource/actions/sceneProse/frame'
import { invokeBedrockConverseText } from '../../llm/invokeBedrockConverseText'
import { novaModelToBedrockModelId, type NovaModel } from '../../llm/novaModel'
import { PROBE_TEMPERATURE, PROBE_TIMEOUT_MS, type ProbeInvoke } from './runSceneReasoningProbe'
import { gradeJudgeReply, judgeReplySteps, type JudgeCall } from './judgeGrade'

/** The judge's reply is a few short lines. */
export const JUDGE_PROBE_MAX_TOKENS = 512

/** A short hash of the text a batch used, so two batches are comparable and a draft is never mistaken for the deployed text. */
export const textHash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 8)

export const runJudgeProbe = async ({ sceneText, requests, repeats, model, instructions = JUDGE_INSTRUCTIONS, invoke = invokeBedrockConverseText }: {
    sceneText: string
    /** The requests to ask, each with the index it has in its set, which results carry. */
    requests: readonly { index: number; request: JudgeRequest }[]
    repeats: number
    model: NovaModel
    instructions?: string
    invoke?: ProbeInvoke
}): Promise<JudgeCall[]> => {
    const steps = judgeReplySteps(instructions)
    const calls = requests.flatMap(({ index, request }) => Array.from({ length: repeats }, (_, repeat) => ({ index, request, repeat: repeat + 1 })))
    return Promise.all(calls.map(async ({ index, request, repeat }): Promise<JudgeCall> => {
        const result = await invoke({
            modelId: novaModelToBedrockModelId(model),
            messages: [{ role: 'user', content: [{ text: composeJudgePrompt({ sceneText, request: request.request, instructions }) }] }],
            maxTokens: JUDGE_PROBE_MAX_TOKENS,
            temperature: PROBE_TEMPERATURE,
            timeoutMs: PROBE_TIMEOUT_MS,
        })
        return result.success
            ? { request: index, repeat, answer: result.body, grade: gradeJudgeReply(request, result.body, steps) }
            : { request: index, repeat, error: result.errorMessage }
    }))
}
