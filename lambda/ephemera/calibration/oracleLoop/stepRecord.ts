//
// The step record (calibration AGENT.md, "The action plan"): a reply's one object, `{"says", "intent"?, "steps"?, "consequences"?}`, the
// target step restated, with `"improvise"?`, the things improvised for it, where the piece's merge takes them. The reply gives only what the model alone can provide (the user, 2026-11-19); code reads it as changes in the change
// language, supplying the verbs, the list, `to` and the detail answered, and merges it. Shared by the pieces that reply with it: a piece
// whose reply holds fields beside the record takes them off first, so a key that is no one's is still refused.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { bracketChanges, improvisedHandles, mergeStepChanges, planSteps, type ActionPlan, type MergeOptions } from './actionPlan'

/** The record's keys: the step restated, its sub-steps, and what the step as a whole brings about. */
const RECORD_KEYS = ['says', 'intent', 'steps', 'consequences'] as const

/** Whether a merge takes improvised things, and so a record of its piece's may hold them. */
const improvises = ({ adds = [] }: Pick<MergeOptions, 'adds'>): boolean => adds.includes('improvise')

/** What is wrong with the record's own form, before its changes are read. */
export const recordProblems = (record: Record<string, unknown>, options: Pick<MergeOptions, 'adds'> = {}): string[] => {
    const keys: readonly string[] = improvises(options) ? ['improvise', ...RECORD_KEYS] : RECORD_KEYS
    const other = Object.keys(record).filter((key) => !keys.includes(key))
    const { improvise, consequences } = record
    return [
        ...(other.length > 0 ? [`has ${other.map((key) => `"${key}"`).join(', ')}, not one of ${keys.join(', ')}`] : []),
        ...('says' in record ? [] : ['the record restates the step: it needs "says"']),
        ...(improvises(options) && improvise !== undefined && !Array.isArray(improvise) ? ['"improvise" is not a list'] : []),
        ...(consequences !== undefined && !Array.isArray(consequences) ? ['"consequences" is not a list'] : []),
    ]
}

/**
 * The record as the changes it stands for, each with the label its problems take in the reply's terms: the restatement first, with the
 * detail it answers where a request asked for one, then the expansion when there are `steps`, then a change for each of the record's
 * consequences, and for each thing it improvises. A sub-step's own `consequences` ride in its entry.
 */
const recordChanges = ({ says, intent, steps, consequences, improvise }: Record<string, unknown>, answered: string | undefined): { changes: unknown[]; labels: string[] } => {
    // An entry that isn't an object is passed on as it is, so the merge refuses it as a change that isn't one.
    const changesOf = (add: 'consequence' | 'improvise', list: unknown): unknown[] =>
        ((list ?? []) as unknown[]).map((entry) => (typeof entry === 'object' && entry !== null && !Array.isArray(entry) ? { add, ...entry } : entry))
    const added = changesOf('consequence', consequences)
    const improvised = changesOf('improvise', improvise)
    // An empty `steps` is none: the step itself is the answer (the user, 2026-11-20; batch 44's OC-1b wrote `"steps": []` 3 of 3).
    const expansion = steps === undefined || (Array.isArray(steps) && steps.length === 0) ? [] : [{ add: 'steps', steps }]
    return {
        changes: [{ restate: 'step', says, ...(intent === undefined ? {} : { intent }), ...(answered === undefined ? {} : { answered }) }, ...expansion, ...added, ...improvised],
        labels: ['', ...expansion.map(() => ''), ...added.map((_, index) => `consequence ${index + 1}: `), ...improvised.map((_, index) => `improvised thing ${index + 1}: `)],
    }
}

/**
 * A merge problem as the reply's: the restatement's and the expansion's prefixes go, since they are the record's own; a consequence
 * change's is the record's consequence, and an improvised thing's the record's. Its own "add" is code's, so a problem naming it is the merge's
 * wording for a key the reply wrote.
 */
const recordProblem = (problem: string, labels: readonly string[]): string =>
    problem.replace(/^change (\d+): /, (prefix, index: string) => labels[Number(index) - 1] ?? prefix)

/** The rule handles a plan's items hold: they name rules, not things. */
const planRuleHandles = (plan: ActionPlan): string[] => planSteps(plan).flatMap(({ items }) => items.flatMap((item) => (item.kind === 'consequence' ? (item.rules ?? []).map(({ rule }) => rule) : [])))

/**
 * A record read as changes, its bare handles bracketed, scoped to the target and merged into the plan (`mergeStepChanges`), or every problem
 * with it in the reply's terms. `things` are the handles it may name bare, less any that names a rule: the `rules` the prompt shows, which
 * are the ones its consequences may name, and those the plan holds; the record's own improvised handles join them. `answered` is the detail a request asked for, where one did.
 */
export const mergeStepRecord = ({ plan, target, record, things, rules, answered }: {
    plan: ActionPlan
    target: string
    record: Record<string, unknown>
    things: readonly SceneHandle[]
    rules: readonly string[]
    answered?: string
}, options: MergeOptions): { plan: ActionPlan } | { problems: string[] } => {
    const problems = recordProblems(record, options)
    if (problems.length > 0) {
        return { problems }
    }
    const { changes, labels } = recordChanges(record, answered)
    const notThings = new Set([...rules, ...planRuleHandles(plan)])
    const handles = [...new Set(things)].filter((handle) => !notThings.has(handle))
    const own = improvises(options) ? improvisedHandles((record.improvise ?? []) as unknown[]).filter((handle) => !notThings.has(handle)) : []
    const merged = mergeStepChanges(plan, target, bracketChanges({ changes }, [...handles, ...own]), handles, { ...options, rules })
    return 'problems' in merged ? { problems: merged.problems.map((problem) => recordProblem(problem, labels)) } : merged
}
