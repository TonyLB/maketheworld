//
// The scene-reasoning probe's match flag: a reading aid only (the user judges). An expected answer is canonicalised to tokens;
// the model's reply is split on commas and lines. An expectation that tokens cannot carry is unscored (`undefined`).
//
import type { SceneAnswer } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { isJudgeLabel, isTriageLabel, type JudgeLabel, type TriageLabel } from '../../dataSource/actions/sceneProse/frame'

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

const bareWord = (text: string): string => text.replace(/[\[\]"'*`]/g, '').replace(/[.!:;,]+$/, '').trim().toLowerCase()

/**
 * A triage reply's match flag. The label is the last word of the reply if that is a label (a reason sentence came first, and the
 * model may not give the label its own line), else the first word (a reason came after it, as `triageWhyImpossible` asks). A
 * label mid-sentence is not a match.
 * Absent expected label: unscored.
 */
export const scoreTriage = (expected: TriageLabel | JudgeLabel | undefined, reply: string): boolean | undefined => {
    if (expected === undefined) {
        return undefined
    }
    const words = reply.trim().split(/\s+/)
    const last = bareWord(words[words.length - 1] ?? '')
    return (isTriageLabel(last) ? last : bareWord(words[0] ?? '')) === expected
}

export type JudgeReply = { label?: JudgeLabel; sentence?: string; lines: Record<string, string> }

/**
 * The judge's reply (judgePrompt plan, Slice 3): one line per step of its Task, each starting with its name, whatever steps a draft of the Task has. The label is the first word
 * after `Answer:`, and the rest of that line is the sentence the label asks for; code routes on the label alone. A reply with no
 * `Answer:` line, or a first word that is no label, has no label. Markdown emphasis around either is stripped.
 */
export const parseJudgeReply = (reply: string): JudgeReply => {
    const lines: Record<string, string> = {}
    reply.split('\n').forEach((line) => {
        const match = line.match(/^\s*(?:\d+\.\s*)?[*_`]*\s*([A-Za-z]+(?: \([^)]*\))?)\s*[*_`]*\s*:[*_`]*\s*(.*)$/i)
        if (match !== null && lines[match[1].toLowerCase()] === undefined) {
            lines[match[1].toLowerCase()] = match[2].trim()
        }
    })
    const answer = lines.answer
    if (answer === undefined) {
        return { lines }
    }
    const [first, ...rest] = answer.split(/\s+/)
    const label = bareWord(first ?? '')
    const sentence = rest.join(' ').replace(/^[-:\u2013\u2014]\s*/, '').trim()
    return isJudgeLabel(label) ? { label, ...(sentence.length > 0 ? { sentence } : {}), lines } : { lines }
}

/** A judge reply's match flag: its label against the expected one. Absent expected label: unscored. */
export const scoreJudge = (expected: JudgeLabel | undefined, reply: string): boolean | undefined => (
    expected === undefined ? undefined : parseJudgeReply(reply).label === expected
)
