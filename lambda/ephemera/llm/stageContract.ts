//
// A typed stage contract: what one LLM call (a stage) reads, what it gives, and how its reply becomes that output. `parse` is the single
// source of truth for a stage's reply: its form check is the parse's problems, and a recorded output is the parse's value. Feature code
// declares each stage's contract (its domain validation); this file holds only the shape, and the reply-to-JSON-object step every such
// parse starts from, after `splitMarkdownReasoningAndJson`.
//
import { splitMarkdownReasoningAndJson } from './splitMarkdownReasoningAndJson'

/** A parsed reply: the stage's output, or every problem found with the reply's form. */
export type StageParse<Output> = { value: Output } | { problems: string[] }

/** What a stage's call was shown: the stage's input, and the prompt text rendered from it (for checks that match quotes against it). */
export type StageShown<Input> = { input: Input; rendered: string }

/** A stage: its name, and how a reply to a call shown its input becomes its output. */
export type StageContract<Input, Output> = {
    name: string
    parse: (reply: string, shown: StageShown<Input>) => StageParse<Output>
}

/** The problems of a parse: none when it gave a value. */
export const parseProblems = <Output>(parsed: StageParse<Output>): string[] => ('problems' in parsed ? parsed.problems : [])

const NOT_AN_OBJECT = 'the JSON block is not an object'

/** The object a JSON text holds, or why it holds none. */
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

/** Whether a `jsonObject` refusal is only that the JSON held something other than an object. */
export const isNotAnObject = (malformed: string): boolean => malformed === NOT_AN_OBJECT

/** The object a reply's trailing JSON holds (`splitMarkdownReasoningAndJson`), or why there is none. */
export const replyJsonObject = (reply: string): { object: Record<string, unknown> } | { malformed: string } => {
    const split = splitMarkdownReasoningAndJson(reply)
    return split.ok ? jsonObject(split.jsonText) : { malformed: 'no JSON block' }
}
