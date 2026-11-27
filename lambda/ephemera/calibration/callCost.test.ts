import { costOf, summarizeCost } from './callCost'

describe('a probe call\'s cost', () => {
    it('takes the wall time, and Bedrock\'s latency and tokens where the call succeeded', () => {
        expect(costOf({ success: true, body: 'x', latencyMs: 250, usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 } }, 400)).toEqual({ ms: 400, latencyMs: 250, inputTokens: 10, outputTokens: 3 })
        expect(costOf({ success: true, body: 'x' }, 400)).toEqual({ ms: 400 })
        expect(costOf({ success: false, errorMessage: 'timeout' }, 90)).toEqual({ ms: 90 })
    })

    it('summarizes a batch: the lower middle value, the largest, and the tokens\' totals, each over the calls that gave it', () => {
        expect(summarizeCost([
            { ms: 400, latencyMs: 300, inputTokens: 10, outputTokens: 5 },
            { ms: 100, latencyMs: 100, inputTokens: 10, outputTokens: 1 },
            { ms: 900 },
            { ms: 200, latencyMs: 200, inputTokens: 12, outputTokens: 9 },
            undefined,
        ])).toEqual({
            ms: { n: 4, median: 200, max: 900 },
            latencyMs: { n: 3, median: 200, max: 300 },
            inputTokens: { n: 3, median: 10, max: 12, total: 32 },
            outputTokens: { n: 3, median: 5, max: 9, total: 15 },
        })
    })

    it('leaves out what no call gave', () => {
        expect(summarizeCost([])).toEqual({})
        expect(summarizeCost([{ ms: 5 }])).toEqual({ ms: { n: 1, median: 5, max: 5 } })
    })
})
