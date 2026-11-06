//
// The judge probe's grading: what code can decide, decided by code, so a batch can be read from a tally
// before its replies. The label is the verdict, graded by what an error costs: a pass is
// the expected label, a border case is a label the request tolerates, and anything else is a failure, a wrong `simple` always. The
// reply's form (the steps the instructions number, in order, each starting with its name) is checked, and `mentions` / `avoids` are lexical reading
// aids that flag a reply, never fail one.
//
import { JUDGE_INSTRUCTIONS, type JudgeLabel } from '../../dataSource/actions/sceneProse/frame'
import type { JudgeRequest } from '../../dataSource/positions/ludicCache/sceneFixtures'
import { parseJudgeReply } from './sceneReasoningScore'

export type JudgeVerdict = 'pass' | 'border' | 'failure'

/**
 * The steps a reply should have, in order: the numbered steps of the instructions it was asked under, so a draft that adds a step
 * is graded by its own form. `Revises (if it happens)` is keyed `revises`.
 */
export const judgeReplySteps = (instructions: string): string[] => (
    [...instructions.matchAll(/^\d+\.\s*([A-Za-z]+)/gm)].map(([, step]) => step.toLowerCase())
)

export type JudgeGrade = {
    verdict: JudgeVerdict
    /** The reply's label; absent when the reply has no `Answer:` line or its first word is no label. */
    label?: JudgeLabel
    /** Steps missing from the reply, and whether those present came in order. */
    form: { missing: string[]; inOrder: boolean }
    /** A wrong `simple` (the label is `simple` where it was not expected): never recoverable, never a border case. */
    wrongSimple: boolean
    /** Reading aids: `mentions` found none of its words in the obstacle and answer sentence; `avoided` lists the `avoids` words found. */
    flags: { mentionMissing: boolean; avoided: string[] }
}

const stepOf = (key: string): string => key.replace(/\s*\(.*$/, '')

export const gradeJudgeReply = (request: JudgeRequest, reply: string, steps: readonly string[] = judgeReplySteps(JUDGE_INSTRUCTIONS)): JudgeGrade => {
    const { label, sentence, lines } = parseJudgeReply(reply)
    const keys = Object.keys(lines).map(stepOf)
    const present = steps.filter((step) => keys.includes(step))
    const wrongSimple = label === 'simple' && request.expect !== 'simple'
    const verdict: JudgeVerdict = label === undefined || wrongSimple
        ? 'failure'
        : label === request.expect ? 'pass' : (request.tolerate ?? []).includes(label) ? 'border' : 'failure'
    const says = [Object.entries(lines).find(([key]) => stepOf(key) === 'obstacle')?.[1] ?? '', sentence ?? ''].join(' ').toLowerCase()
    return {
        verdict,
        ...(label !== undefined ? { label } : {}),
        form: {
            missing: steps.filter((step) => !present.includes(step)),
            inOrder: keys.filter((step) => steps.includes(step)).join() === present.join(),
        },
        wrongSimple,
        flags: {
            mentionMissing: request.mentions !== undefined && !request.mentions.some((word) => says.includes(word.toLowerCase())),
            avoided: (request.avoids ?? []).filter((word) => says.includes(word.toLowerCase())),
        },
    }
}

export type JudgeCall = { request: number; repeat: number; answer?: string; error?: string; grade?: JudgeGrade }

export type JudgeRequestTally = {
    request: string
    expect: JudgeLabel
    calls: number
    labels: Partial<Record<JudgeLabel | 'none', number>>
    pass: number
    border: number
    failure: number
    errors: number
    /** Calls flagged by a reading aid or a form fault: worth a human look even when the label passed. */
    flagged: number
}

export type JudgeSummary = {
    calls: number
    pass: number
    border: number
    failure: number
    wrongSimple: number
    errors: number
    malformed: number
    requests: JudgeRequestTally[]
}

const isFlagged = ({ form, flags }: JudgeGrade): boolean => (
    form.missing.length > 0 || !form.inOrder || flags.mentionMissing || flags.avoided.length > 0
)

export const summarizeJudge = (requests: readonly JudgeRequest[], calls: readonly JudgeCall[]): JudgeSummary => {
    const tallies: JudgeRequestTally[] = requests.map(({ request, expect }, index) => {
        const mine = calls.filter((call) => call.request === index)
        const graded = mine.flatMap(({ grade }) => grade === undefined ? [] : [grade])
        const labels: JudgeRequestTally['labels'] = {}
        graded.forEach(({ label }) => { labels[label ?? 'none'] = (labels[label ?? 'none'] ?? 0) + 1 })
        return {
            request, expect, calls: mine.length, labels,
            pass: graded.filter(({ verdict }) => verdict === 'pass').length,
            border: graded.filter(({ verdict }) => verdict === 'border').length,
            failure: graded.filter(({ verdict }) => verdict === 'failure').length,
            errors: mine.length - graded.length,
            flagged: graded.filter(isFlagged).length,
        }
    })
    const graded = calls.flatMap(({ grade }) => grade === undefined ? [] : [grade])
    return {
        calls: calls.length,
        pass: graded.filter(({ verdict }) => verdict === 'pass').length,
        border: graded.filter(({ verdict }) => verdict === 'border').length,
        failure: graded.filter(({ verdict }) => verdict === 'failure').length,
        wrongSimple: graded.filter(({ wrongSimple }) => wrongSimple).length,
        errors: calls.length - graded.length,
        malformed: graded.filter(({ form }) => form.missing.length > 0 || !form.inOrder).length,
        requests: tallies.filter(({ calls }) => calls > 0),
    }
}
