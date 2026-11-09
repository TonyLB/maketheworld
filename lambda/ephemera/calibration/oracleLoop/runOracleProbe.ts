//
// The oracle probe's runner (oracleLoop Slice 3, a Prototype): one Bedrock call per (case, repeat), each a whole draft prompt, read by hand.
// The only check is the reply's form against the draft's numbered steps: no label grade, which means nothing for an oracle draft.
//
import { invokeBedrockConverseText } from '../../llm/invokeBedrockConverseText'
import { novaModelToBedrockModelId, type NovaModel } from '../../llm/novaModel'
import { replyForm, type ReplyForm } from '../sceneReasoning/judgeGrade'
import { JUDGE_PROBE_MAX_TOKENS } from '../sceneReasoning/runJudgeProbe'
import { PROBE_TEMPERATURE, PROBE_TIMEOUT_MS, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'

export type OracleCall = { case: string; repeat: number; answer?: string; error?: string; form?: ReplyForm }

export type OracleSummary = { calls: number; errors: number; malformed: number }

export const runOracleProbe = async ({ prompts, steps, repeats, model, invoke = invokeBedrockConverseText }: {
    prompts: readonly { caseId: string; prompt: string }[]
    /** The draft's numbered steps, which each reply's form is checked against. */
    steps: readonly string[]
    repeats: number
    model: NovaModel
    invoke?: ProbeInvoke
}): Promise<OracleCall[]> => {
    const calls = prompts.flatMap(({ caseId, prompt }) => Array.from({ length: repeats }, (_, repeat) => ({ caseId, prompt, repeat: repeat + 1 })))
    return Promise.all(calls.map(async ({ caseId, prompt, repeat }): Promise<OracleCall> => {
        const result = await invoke({
            modelId: novaModelToBedrockModelId(model),
            messages: [{ role: 'user', content: [{ text: prompt }] }],
            maxTokens: JUDGE_PROBE_MAX_TOKENS,
            temperature: PROBE_TEMPERATURE,
            timeoutMs: PROBE_TIMEOUT_MS,
        })
        return result.success
            ? { case: caseId, repeat, answer: result.body, form: replyForm(result.body, steps) }
            : { case: caseId, repeat, error: result.errorMessage }
    }))
}

export const summarizeOracle = (calls: readonly OracleCall[]): OracleSummary => ({
    calls: calls.length,
    errors: calls.filter(({ form }) => form === undefined).length,
    malformed: calls.filter(({ form }) => form !== undefined && (form.missing.length > 0 || !form.inOrder)).length,
})
