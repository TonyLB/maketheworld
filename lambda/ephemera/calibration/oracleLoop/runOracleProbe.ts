//
// The oracle probe's runner (oracleLoop Slice 3, a Prototype): one Bedrock call per (case, repeat), each a whole draft prompt, read by hand.
// The only check is the reply's form against the draft's numbered steps: no label grade, which means nothing for an oracle draft.
//
import { invokeBedrockConverseText } from '../../llm/invokeBedrockConverseText'
import { novaModelToBedrockModelId, type NovaModel } from '../../llm/novaModel'
import { replyForm, type ReplyForm } from '../sceneReasoning/judgeGrade'
import { JUDGE_PROBE_MAX_TOKENS } from '../sceneReasoning/runJudgeProbe'
import { PROBE_TEMPERATURE, PROBE_TIMEOUT_MS, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'

export type ProbeCall = { id: string; repeat: number; answer?: string; error?: string }

export type OracleCall = { case: string; repeat: number; answer?: string; error?: string; form?: ReplyForm }

export type OracleSummary = { calls: number; errors: number; malformed: number }

/** One Bedrock call per (prompt, repeat), concurrently, each a whole prompt in one user turn. Shared with the piece probe. */
export const runProbeCalls = async ({ prompts, repeats, model, invoke = invokeBedrockConverseText }: {
    prompts: readonly { id: string; prompt: string }[]
    repeats: number
    model: NovaModel
    invoke?: ProbeInvoke
}): Promise<ProbeCall[]> => {
    const calls = prompts.flatMap(({ id, prompt }) => Array.from({ length: repeats }, (_, repeat) => ({ id, prompt, repeat: repeat + 1 })))
    return Promise.all(calls.map(async ({ id, prompt, repeat }): Promise<ProbeCall> => {
        const result = await invoke({
            modelId: novaModelToBedrockModelId(model),
            messages: [{ role: 'user', content: [{ text: prompt }] }],
            maxTokens: JUDGE_PROBE_MAX_TOKENS,
            temperature: PROBE_TEMPERATURE,
            timeoutMs: PROBE_TIMEOUT_MS,
        })
        return result.success ? { id, repeat, answer: result.body } : { id, repeat, error: result.errorMessage }
    }))
}

export const runOracleProbe = async ({ prompts, steps, repeats, model, invoke }: {
    prompts: readonly { caseId: string; prompt: string }[]
    /** The draft's numbered steps, which each reply's form is checked against. */
    steps: readonly string[]
    repeats: number
    model: NovaModel
    invoke?: ProbeInvoke
}): Promise<OracleCall[]> => (
    (await runProbeCalls({ prompts: prompts.map(({ caseId, prompt }) => ({ id: caseId, prompt })), repeats, model, ...(invoke !== undefined ? { invoke } : {}) }))
        .map(({ id, repeat, answer, error }): OracleCall => (
            answer !== undefined ? { case: id, repeat, answer, form: replyForm(answer, steps) } : { case: id, repeat, error }
        ))
)

export const summarizeOracle = (calls: readonly OracleCall[]): OracleSummary => ({
    calls: calls.length,
    errors: calls.filter(({ form }) => form === undefined).length,
    malformed: calls.filter(({ form }) => form !== undefined && (form.missing.length > 0 || !form.inOrder)).length,
})
