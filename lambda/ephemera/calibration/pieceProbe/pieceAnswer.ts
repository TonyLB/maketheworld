//
// The piece probe's grade. A reply that ends in a JSON object (best as a trailing fenced `json` block, the house shape for reasoning
// then JSON: llm/AGENT.md) is graded by its `answer` field; any other reply by its last line starting `Answer:`, its first word. Either
// way the answer is read against the piece's closed answer set. The verdict goes last, as Micro needs, so any reasoning before it is
// free text. The `Answer:` route stays so earlier drafts grade as they did.
//
import { splitMarkdownReasoningAndJson } from '../../llm/splitMarkdownReasoningAndJson'

export type PieceGrade = { answer: string } | { malformed: string }

const inSet = (word: string, answers: readonly string[]): PieceGrade => (
    answers.includes(word) ? { answer: word } : { malformed: `"${word}" is not one of ${answers.join(', ')}` }
)

const NOT_AN_OBJECT = 'the JSON block is not an object'

/** The object a JSON text holds, or why it holds none: for a piece's own grade as well as this one. */
export const jsonObject = (jsonText: string): { object: Record<string, unknown> } | { malformed: string } => {
    let value: unknown
    try {
        value = JSON.parse(jsonText)
    } catch {
        return { malformed: 'the JSON block does not parse' }
    }
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? { object: value as Record<string, unknown> }
        : { malformed: NOT_AN_OBJECT }
}

/** The object a reply's trailing JSON holds (`splitMarkdownReasoningAndJson`), or why there is none. */
export const replyJsonObject = (reply: string): { object: Record<string, unknown> } | { malformed: string } => {
    const split = splitMarkdownReasoningAndJson(reply)
    return split.ok ? jsonObject(split.jsonText) : { malformed: 'no JSON block' }
}

const jsonAnswer = (jsonText: string, answers: readonly string[]): PieceGrade => {
    const parsed = jsonObject(jsonText)
    if ('malformed' in parsed && parsed.malformed !== NOT_AN_OBJECT) {
        return parsed
    }
    const answer = 'object' in parsed ? parsed.object.answer : undefined
    return typeof answer === 'string' ? inSet(answer.trim().toLowerCase(), answers) : { malformed: 'the JSON block has no string "answer"' }
}

const lineAnswer = (reply: string, answers: readonly string[]): PieceGrade => {
    const line = reply.split('\n').map((text) => text.trim()).filter((text) => text.startsWith('Answer:')).slice(-1)[0]
    if (line === undefined) {
        return { malformed: 'no Answer line' }
    }
    return inSet((line.slice('Answer:'.length).trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/\p{P}+$/u, ''), answers)
}

export const pieceAnswer = (reply: string, answers: readonly string[]): PieceGrade => {
    const split = splitMarkdownReasoningAndJson(reply)
    return split.ok ? jsonAnswer(split.jsonText, answers) : lineAnswer(reply, answers)
}
