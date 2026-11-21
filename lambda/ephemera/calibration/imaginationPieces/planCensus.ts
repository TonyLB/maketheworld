//
// The consequence census of a `playByPlay` batch: how its replies fill the consequence and rule slots, and, where a reply reasons
// before its JSON, whether the reasoning's decisions agree with the JSON. Pure: it reads the replies' JSON only, with no scene, so an
// invented rule handle is read-plans' form check, not this. The CLI is `planCensusCli.ts` (`npm run plan-census`).
//
import { splitMarkdownReasoningAndJson } from '../../llm/splitMarkdownReasoningAndJson'
import type { ReadGroup } from '../pieceProbe/readPiece'

/**
 * One consequence as the reply wrote it. `onHandled`: every handle its `thing` names is one its step names (the thing being handled).
 * `restatesIntent`: its `says` is its step's intent, or holds it, or is held in it, once case, brackets and punctuation are set aside
 * (the filler: the step's own aim given again as what it brings about).
 */
export type ConsequenceRead = { says: string; thing: string; onHandled: boolean; restatesIntent: boolean; stances: string[] }

/** How a reasoning line's decision stands against the JSON: it agrees, disagrees, or the reasoning has no line for it. */
export type Agreement = 'agrees' | 'disagrees' | 'absent'

export type SubStepRead = { says: string; consequences: ConsequenceRead[]; agreement: Agreement }

export type ReplyRead =
    | { cell: string; repeat: number; parsed: false }
    | {
        cell: string
        repeat: number
        parsed: true
        reasoning: string
        steps: SubStepRead[]
        /** The record's own consequences, beside its `steps` (the step as the answer, or a revision's). */
        consequences: ConsequenceRead[]
        /** The step line ("is the answer" / "broken down") against whether the reply breaks the step down. */
        stepAgreement: Agreement
        /** The stances the reasoning decides (one per line that names a rule), against the JSON's; absent with no reasoning, or when neither names one. */
        stanceAgreement: Agreement
    }

const handles = (text: string): string[] => [...text.matchAll(/\[([^\]]+)\]/g)].map(([, handle]) => handle)

const asRecord = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {})
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

const plain = (text: string): string => text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

const restates = (says: string, intent: string): boolean => {
    const [a, b] = [plain(says), plain(intent)]
    return a !== '' && b !== '' && (a.includes(b) || b.includes(a))
}

const readConsequence = (stepSays: string, stepIntent: string) => (value: unknown): ConsequenceRead => {
    const { says, thing, rules } = asRecord(value)
    const named = handles(asText(thing))
    const acted = new Set(handles(stepSays))
    return {
        says: asText(says),
        thing: asText(thing),
        onHandled: named.length > 0 && named.every((handle) => acted.has(handle)),
        restatesIntent: restates(asText(says), stepIntent),
        stances: asList(rules).map((rule) => asText(asRecord(rule).stance)),
    }
}

/** The reasoning's lines, each without its list marker. */
const reasoningLines = (reasoning: string): string[] => reasoning.split('\n').map((line) => line.trim().replace(/^[-*]\s+/, '')).filter((line) => line !== '')

const subStepAgreement = (lines: readonly string[], says: string, consequences: readonly ConsequenceRead[]): Agreement => {
    const head = `${says.trim().toLowerCase()}:`
    const line = lines.find((candidate) => candidate.toLowerCase().startsWith(head))
    if (line === undefined) {
        return 'absent'
    }
    // A line that gives the intent first answers after "beyond that," ("<says>: <intent>; beyond that, nothing.").
    const answer = line.slice(head.length).split(/\bbeyond (?:that|it)\b,?/i).slice(-1)[0]
    const saysNothing = /^nothing\b/i.test(answer.trim())
    return saysNothing === (consequences.length === 0) ? 'agrees' : 'disagrees'
}

const stepAgreement = (lines: readonly string[], stepCount: number): Agreement => {
    const answer = lines.some((line) => /\bis the answer\b/i.test(line))
    const brokenDown = lines.some((line) => /\bbroken down\b/i.test(line))
    if (!answer && !brokenDown) {
        return 'absent'
    }
    return (answer && !brokenDown && stepCount === 0) || (brokenDown && !answer && stepCount >= 2) ? 'agrees' : 'disagrees'
}

const tally = (stances: readonly string[]): string => [...stances].sort().join(',')

/**
 * The stance a reasoning line decides, if any: the last stance word on a line that names a rule or ends ": <stance>", read freely ("is violated",
 * "causes it", ": violation"), with "No rule" deciding none. A line pasting one stance's phrase beside another ("makes it happen where
 * it ordinarily wouldn't: violation") reads as the later one.
 */
const lineStance = (line: string): string | undefined => {
    if (!/\brules?\b/i.test(line) && !/:\s*(causes|violation|voids)\.?$/i.test(line)) {
        return undefined
    }
    const words = [...line.matchAll(/\b(no rule|caus(?:es|ed|e)|violat(?:ion|ed|es|e|ing)|void(?:s|ed)?)\b/gi)].map(([word]) => word.toLowerCase())
    const last = words[words.length - 1]
    if (last === undefined || last === 'no rule') {
        return undefined
    }
    return last.startsWith('caus') ? 'causes' : last.startsWith('violat') ? 'violation' : 'voids'
}

const stanceAgreement = (lines: readonly string[], json: readonly string[]): Agreement => {
    const named = lines.flatMap((line) => lineStance(line) ?? [])
    if (lines.length === 0 || (named.length === 0 && json.length === 0)) {
        return 'absent'
    }
    return tally(named) === tally(json) ? 'agrees' : 'disagrees'
}

/** One reply read: its JSON's sub-steps and consequences, and its reasoning's agreement with them. */
export const readReply = (cell: string, repeat: number, reply: string): ReplyRead => {
    const split = splitMarkdownReasoningAndJson(reply)
    if (!split.ok) {
        return { cell, repeat, parsed: false }
    }
    let object: Record<string, unknown>
    try {
        object = asRecord(JSON.parse(split.jsonText))
    } catch {
        return { cell, repeat, parsed: false }
    }
    const lines = reasoningLines(split.reasoningMarkdown)
    const steps = asList(object.steps).map((step): SubStepRead => {
        const says = asText(asRecord(step).says)
        const consequences = asList(asRecord(step).consequences).map(readConsequence(says, asText(asRecord(step).intent)))
        return { says, consequences, agreement: subStepAgreement(lines, says, consequences) }
    })
    const consequences = asList(object.consequences).map(readConsequence(asText(object.says), asText(object.intent)))
    const allStances = [...steps.flatMap((step) => step.consequences), ...consequences].flatMap(({ stances }) => stances)
    return {
        cell,
        repeat,
        parsed: true,
        reasoning: split.reasoningMarkdown,
        steps,
        consequences,
        stepAgreement: stepAgreement(lines, steps.length),
        stanceAgreement: stanceAgreement(lines, allStances),
    }
}

export const readGroups = (groups: readonly ReadGroup[]): ReplyRead[] =>
    groups.flatMap(({ cell, replies }) => replies.flatMap(({ repeat, reply }) => (reply === undefined ? [] : [readReply(cell, repeat, reply)])))

type AgreementCounts = Record<Agreement, number>

export type CensusCounts = {
    replies: number
    parsed: number
    withReasoning: number
    /** Replies whose `steps` has one entry: a form failure, most often the folded lift. */
    oneEntrySteps: number
    firstSubSteps: number
    firstWithConsequence: number
    laterSubSteps: number
    laterWithConsequence: number
    consequences: number
    onHandled: number
    restatesIntent: number
    withRule: number
    stances: Record<string, number>
    subStepAgreement: AgreementCounts
    stepAgreement: AgreementCounts
    stanceAgreement: AgreementCounts
}

const noAgreement = (): AgreementCounts => ({ agrees: 0, disagrees: 0, absent: 0 })

const emptyCounts = (): CensusCounts => ({
    replies: 0, parsed: 0, withReasoning: 0, oneEntrySteps: 0, firstSubSteps: 0, firstWithConsequence: 0, laterSubSteps: 0, laterWithConsequence: 0,
    consequences: 0, onHandled: 0, restatesIntent: 0, withRule: 0, stances: {}, subStepAgreement: noAgreement(), stepAgreement: noAgreement(), stanceAgreement: noAgreement(),
})

const bump = <K extends string>(record: Record<K, number>, key: K, by = 1): Record<K, number> => ({ ...record, [key]: (record[key] ?? 0) + by })

const addReply = (counts: CensusCounts, read: ReplyRead): CensusCounts => {
    if (!read.parsed) {
        return { ...counts, replies: counts.replies + 1 }
    }
    const all = [...read.steps.flatMap((step) => step.consequences), ...read.consequences]
    const [first, ...later] = read.steps
    return {
        replies: counts.replies + 1,
        parsed: counts.parsed + 1,
        withReasoning: counts.withReasoning + (read.reasoning.trim() === '' ? 0 : 1),
        oneEntrySteps: counts.oneEntrySteps + (read.steps.length === 1 ? 1 : 0),
        firstSubSteps: counts.firstSubSteps + (first === undefined ? 0 : 1),
        firstWithConsequence: counts.firstWithConsequence + (first !== undefined && first.consequences.length > 0 ? 1 : 0),
        laterSubSteps: counts.laterSubSteps + later.length,
        laterWithConsequence: counts.laterWithConsequence + later.filter((step) => step.consequences.length > 0).length,
        consequences: counts.consequences + all.length,
        onHandled: counts.onHandled + all.filter(({ onHandled }) => onHandled).length,
        restatesIntent: counts.restatesIntent + all.filter(({ restatesIntent }) => restatesIntent).length,
        withRule: counts.withRule + all.filter(({ stances }) => stances.length > 0).length,
        stances: all.flatMap(({ stances }) => stances).reduce((stances, stance) => bump(stances, stance), counts.stances),
        subStepAgreement: read.steps.reduce((agreement, step) => bump(agreement, step.agreement), counts.subStepAgreement),
        stepAgreement: bump(counts.stepAgreement, read.stepAgreement),
        stanceAgreement: bump(counts.stanceAgreement, read.stanceAgreement),
    }
}

export const censusCounts = (reads: readonly ReplyRead[]): CensusCounts => reads.reduce(addReply, emptyCounts())

const agreementText = ({ agrees, disagrees, absent }: AgreementCounts): string => `${agrees} agree, ${disagrees} disagree, ${absent} absent`

const countsLines = (counts: CensusCounts): string[] => [
    `replies ${counts.replies}, parsed ${counts.parsed}, with reasoning ${counts.withReasoning}, one-entry steps ${counts.oneEntrySteps}`,
    `first sub-steps with a consequence ${counts.firstWithConsequence} of ${counts.firstSubSteps}; later ${counts.laterWithConsequence} of ${counts.laterSubSteps}`,
    `consequences ${counts.consequences}: on the handled thing ${counts.onHandled}, restating their step's intent ${counts.restatesIntent}, carrying a rule ${counts.withRule}`
        + ` (${Object.entries(counts.stances).sort(([a], [b]) => a.localeCompare(b)).map(([stance, n]) => `${stance} ${n}`).join(', ') || 'none'})`,
    `reasoning: step line ${agreementText(counts.stepAgreement)}; sub-step lines ${agreementText(counts.subStepAgreement)}; stances ${agreementText(counts.stanceAgreement)}`,
]

const consequenceLine = (where: string) => ({ says, stances, onHandled, restatesIntent }: ConsequenceRead): string =>
    `    ${where} -> ${says}${onHandled ? ' (handled thing)' : ''}${restatesIntent ? ' (its intent)' : ''}${stances.length > 0 ? `  [${stances.join(', ')}]` : ''}`

const replyLines = (read: ReplyRead): string[] => {
    if (!read.parsed) {
        return [`  ${read.cell} r${read.repeat}: no JSON parsed`]
    }
    return [
        `  ${read.cell} r${read.repeat}: ${read.steps.length} steps; step line ${read.stepAgreement}, stances ${read.stanceAgreement}`,
        ...read.steps.flatMap((step, index) => [
            ...(step.agreement === 'absent' ? [] : [`    s${index + 1} line ${step.agreement}`]),
            ...step.consequences.map(consequenceLine(`s${index + 1} [${step.says}]`)),
        ]),
        ...read.consequences.map(consequenceLine('step')),
    ]
}

/** The census as text: the totals, each cell's, and, with `list`, every reply's consequences. */
export const censusText = (reads: readonly ReplyRead[], { list = false }: { list?: boolean } = {}): string => {
    const cells = [...new Set(reads.map(({ cell }) => cell))]
    return [
        '## All cells',
        ...countsLines(censusCounts(reads)),
        ...cells.flatMap((cell) => {
            const own = reads.filter((read) => read.cell === cell)
            return ['', `## ${cell}`, ...countsLines(censusCounts(own)), ...(list ? own.flatMap(replyLines) : [])]
        }),
    ].join('\n')
}
