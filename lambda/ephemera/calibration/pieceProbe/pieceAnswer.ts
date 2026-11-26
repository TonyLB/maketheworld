//
// The piece probe's grade. A reply that ends in a JSON object (best as a trailing fenced `json` block, the house shape for reasoning
// then JSON: llm/AGENT.md) is graded by its `answer` field; any other reply by its last line starting `Answer:`, its first word. Either
// way the answer is read against the piece's closed answer set. The verdict goes last, as Micro needs, so any reasoning before it is
// free text. The `Answer:` route stays so earlier drafts grade as they did.
//
import { splitMarkdownReasoningAndJson } from '../../llm/splitMarkdownReasoningAndJson'
import { isNotAnObject, jsonObject } from '../../llm/stageContract'
import type { ActionPlan } from '../oracleLoop/actionPlan'

/**
 * One reply's grade: its answer, and, for a piece that merges, the plan its reply merged into, for the reader; or why it gives none. A reply
 * whose block the merge refuses is malformed, whatever it answers: a bad block is refused whole. `aspects` are other readings of the reply, by
 * name, each tallied apart from the answer against the cell's `expectedAspects`.
 */
export type PieceGrade = { answer: string; aspects?: Readonly<Record<string, string>>; plan?: ActionPlan } | { malformed: string }

const inSet = (word: string, answers: readonly string[]): PieceGrade => (
    answers.includes(word) ? { answer: word } : { malformed: `"${word}" is not one of ${answers.join(', ')}` }
)

const jsonAnswer = (jsonText: string, answers: readonly string[]): PieceGrade => {
    const parsed = jsonObject(jsonText)
    if ('malformed' in parsed && !isNotAnObject(parsed.malformed)) {
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
