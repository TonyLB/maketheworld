//
// What a probe call cost (calibration AGENT.md, "Piece probe"): its wall time, Bedrock's own latency, and its tokens, and their summary over
// a batch. A batch's calls are sent at once (`runProbeCalls`), so the wall time includes waiting behind the batch's other calls; Bedrock's
// `latencyMs` is the model's time alone, and is the number to compare one prompt's speed with another's.
//
import type { InvokeBedrockConverseTextResult } from '../llm/invokeBedrockConverseText'

export type CallCost = { ms: number; latencyMs?: number; inputTokens?: number; outputTokens?: number }

/** One call's cost: its wall time, and what Bedrock reported where the call succeeded. */
export const costOf = (result: InvokeBedrockConverseTextResult, ms: number): CallCost => {
    if (!result.success) {
        return { ms }
    }
    const { latencyMs, usage } = result
    return {
        ms,
        ...(latencyMs === undefined ? {} : { latencyMs }),
        ...(usage?.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
        ...(usage?.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens }),
    }
}

/** A measure over a batch: how many calls gave it, the median (the lower middle value) and the largest; `total` for tokens. */
export type CostMeasure = { n: number; median: number; max: number }

export type CostSummary = {
    ms?: CostMeasure
    latencyMs?: CostMeasure
    inputTokens?: CostMeasure & { total: number }
    outputTokens?: CostMeasure & { total: number }
}

const measure = (values: readonly number[]): CostMeasure | undefined => {
    if (values.length === 0) {
        return undefined
    }
    const sorted = [...values].sort((one, other) => one - other)
    return { n: sorted.length, median: sorted[Math.floor((sorted.length - 1) / 2)], max: sorted[sorted.length - 1] }
}

const tokens = (values: readonly number[]): (CostMeasure & { total: number }) | undefined => {
    const found = measure(values)
    return found === undefined ? undefined : { ...found, total: values.reduce((sum, value) => sum + value, 0) }
}

/** The batch's cost, each measure over the calls that gave it, and absent where none did. */
export const summarizeCost = (costs: readonly (CallCost | undefined)[]): CostSummary => {
    const given = costs.flatMap((cost) => (cost === undefined ? [] : [cost]))
    const of = (key: keyof CallCost): number[] => given.flatMap((cost) => (cost[key] === undefined ? [] : [cost[key] as number]))
    const ms = measure(of('ms'))
    const latencyMs = measure(of('latencyMs'))
    const inputTokens = tokens(of('inputTokens'))
    const outputTokens = tokens(of('outputTokens'))
    return {
        ...(ms === undefined ? {} : { ms }),
        ...(latencyMs === undefined ? {} : { latencyMs }),
        ...(inputTokens === undefined ? {} : { inputTokens }),
        ...(outputTokens === undefined ? {} : { outputTokens }),
    }
}
