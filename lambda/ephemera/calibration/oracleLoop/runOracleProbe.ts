//
// The oracle probe's runner (oracleLoop Slice 3, a Prototype): one Bedrock call per (case, repeat), each a whole draft prompt, read by hand.
// The only check is the reply's form against the draft's numbered steps: no label grade, which means nothing for an oracle draft.
//
import { invokeBedrockConverseText } from '../../llm/invokeBedrockConverseText'
import { costOf, type CallCost } from '../callCost'
import { novaModelToBedrockModelId, type NovaModel } from '../../llm/novaModel'
import { replyForm, type ReplyForm } from '../sceneReasoning/judgeGrade'
import { JUDGE_PROBE_MAX_TOKENS } from '../sceneReasoning/runJudgeProbe'
import { PROBE_TEMPERATURE, PROBE_TIMEOUT_MS, type ProbeInvoke } from '../sceneReasoning/runSceneReasoningProbe'

export type ProbeCall = { id: string; repeat: number; answer?: string; error?: string; cost: CallCost }

export type OracleCall = { case: string; repeat: number; answer?: string; error?: string; form?: ReplyForm }

export type OracleSummary = { calls: number; errors: number; malformed: number }

/**
 * One Bedrock call per (prompt, repeat), concurrently, each prompt in one user turn, with its `system` text sent as system instructions
 * where it has one, and what each cost (`costOf`), its wall time read off `now`. Shared with the piece probe.
 */
export const runProbeCalls = async ({ prompts, repeats, model, maxTokens = JUDGE_PROBE_MAX_TOKENS, invoke = invokeBedrockConverseText, now = Date.now }: {
    prompts: readonly { id: string; prompt: string; system?: string }[]
    repeats: number
    model: NovaModel
    /** The output cap per call; the judge probe's by default. */
    maxTokens?: number
    invoke?: ProbeInvoke
    /** The clock a call's wall time is read from, in milliseconds. */
    now?: () => number
}): Promise<ProbeCall[]> => {
    const calls = prompts.flatMap(({ id, prompt, system }) => Array.from({ length: repeats }, (_, repeat) => ({ id, prompt, system, repeat: repeat + 1 })))
    return Promise.all(calls.map(async ({ id, prompt, system, repeat }): Promise<ProbeCall> => {
        const started = now()
        const result = await invoke({
            modelId: novaModelToBedrockModelId(model),
            messages: [{ role: 'user', content: [{ text: prompt }] }],
            maxTokens,
            temperature: PROBE_TEMPERATURE,
            timeoutMs: PROBE_TIMEOUT_MS,
            ...(system !== undefined ? { system } : {}),
        })
        const cost = costOf(result, now() - started)
        return result.success ? { id, repeat, answer: result.body, cost } : { id, repeat, error: result.errorMessage, cost }
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
