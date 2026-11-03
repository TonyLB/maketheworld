//
// The scene-reasoning probe's match flag: a reading aid only (the user judges). An expected answer is canonicalised to tokens;
// the model's reply is split on commas and lines. An expectation that tokens cannot carry is unscored (`undefined`).
//
import type { SceneAnswer } from '../../dataSource/positions/ludicCache/sceneFixtures'

export type ExpectedTokens = { kind: 'set'; tokens: string[] } | { kind: 'count'; count: number }

/** Expected answer as tokens: handles, `room`, `held`, or a count. Locations or targets of any other kind are unscored. */
export const expectedTokens = (answer: SceneAnswer): ExpectedTokens | undefined => {
    if ('count' in answer) {
        return { kind: 'count', count: answer.count }
    }
    if ('handles' in answer) {
        return { kind: 'set', tokens: answer.handles }
    }
    const items = 'locations' in answer ? answer.locations : answer.targets
    const tokens: string[] = []
    for (const item of items) {
        if (item.kind === 'room' || item.kind === 'held') {
            tokens.push(item.kind)
        } else if (item.kind === 'thing') {
            tokens.push(item.handle)
        } else {
            return undefined
        }
    }
    return { kind: 'set', tokens }
}

/** The reply's tokens: items split on commas and newlines, bullets and brackets and trailing dots stripped, lowercased. */
export const replyTokens = (reply: string): string[] => reply
    .split(/[,\n]/)
    .map((item) => item.replace(/^\s*[-*]\s+/, '').replace(/[\[\]]/g, '').replace(/\.\s*$/, '').trim().toLowerCase())
    .filter((item) => item.length > 0 && item !== 'none')

export const scoreReply = (expected: ExpectedTokens | undefined, reply: string): boolean | undefined => {
    if (expected === undefined) {
        return undefined
    }
    if (expected.kind === 'count') {
        const match = reply.match(/\d+/)
        return match !== null && Number(match[0]) === expected.count
    }
    const got = new Set(replyTokens(reply))
    const want = new Set(expected.tokens.map((token) => token.toLowerCase()))
    return got.size === want.size && [...want].every((token) => got.has(token))
}
