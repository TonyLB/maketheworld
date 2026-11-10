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

const jsonAnswer = (jsonText: string, answers: readonly string[]): PieceGrade => {
    let value: unknown
    try {
        value = JSON.parse(jsonText)
    } catch {
        return { malformed: 'the JSON block does not parse' }
    }
    const answer = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>).answer : undefined
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
