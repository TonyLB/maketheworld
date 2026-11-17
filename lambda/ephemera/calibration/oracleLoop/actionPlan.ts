//
// The action plan (AGENT.actionPlan.planning.md, step 1, a Prototype): a candidate step with a path and its sub-items, built from each
// step shape in use, and a render for a generator to read. No piece reads it yet, and every existing render reads its own inputs.
// Paths are readable slugs minted at creation (AP-2); with additions only, a path never changes, so it is the item's id.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import type { NonRuleStep } from '../oraclePieces/nonRuleCell'
import type { CandidateStep } from './oracleInputs'

export type StepItem =
    | { kind: 'intent'; path: string; says: string }
    | { kind: 'consequence'; path: string; says: string; thing?: SceneHandle; intended?: true }
    /** The imagination's "possible problem": a deferral the oracle classifies, not a judge's claim. */
    | { kind: 'concern'; path: string; says: string }

export type StepItemKind = StepItem['kind']

/** The order of kinds within a step (AP-3). */
export const STEP_ITEM_KINDS: readonly StepItemKind[] = ['intent', 'consequence', 'concern']

export type PlannedStep = CandidateStep & { path: string; items: readonly StepItem[] }

export type ActionPlan = { steps: readonly PlannedStep[] }

const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'to', 'into', 'onto', 'off', 'from', 'with', 'and', 'so', 'that', 'is', 'are'])

/** A text's first three words that aren't stopwords, lower case, handles without their brackets; the fallback when none remain. */
export const slug = (text: string, fallback: string): string => {
    const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((word) => word !== '' && !STOPWORDS.has(word))
    return words.length === 0 ? fallback : words.slice(0, 3).join('-')
}

/** Each text's slug in one scope, a repeat given `-2`, `-3` in order. */
export const mintPaths = (texts: readonly { says: string; fallback: string }[]): string[] =>
    texts.reduce<{ paths: string[]; seen: Record<string, number> }>(({ paths, seen }, { says, fallback }) => {
        const base = slug(says, fallback)
        const count = (seen[base] ?? 0) + 1
        return { paths: [...paths, count === 1 ? base : `${base}-${count}`], seen: { ...seen, [base]: count } }
    }, { paths: [], seen: {} }).paths

/** Items by kind (intent, consequence, concern), and within a kind in the order given: a stable sort. */
export const orderItems = <Item extends { kind: StepItemKind }>(items: readonly Item[]): Item[] =>
    STEP_ITEM_KINDS.flatMap((kind) => items.filter((item) => item.kind === kind))

type UnmintedItem = StepItem extends infer Item ? (Item extends StepItem ? Omit<Item, 'path'> : never) : never

/** A step's items ordered, then each path minted under the step's, in one scope across kinds. */
const mintItems = (stepPath: string, items: readonly UnmintedItem[]): StepItem[] => {
    const ordered = orderItems(items)
    const paths = mintPaths(ordered.map(({ kind, says }) => ({ says, fallback: kind })))
    return ordered.map((item, index) => ({ ...item, path: `${stepPath}.${paths[index]}` }) as StepItem)
}

const planOf = (steps: readonly { step: CandidateStep; items: readonly UnmintedItem[] }[]): ActionPlan => {
    const paths = mintPaths(steps.map(({ step: { says } }) => ({ says, fallback: 'step' })))
    return { steps: steps.map(({ step, items }, index) => ({ ...step, path: paths[index], items: mintItems(paths[index], items) })) }
}

/** The corpus's steps, each kept as it is, with its path and no sub-items. */
export const planFromCandidateSteps = (steps: readonly CandidateStep[]): ActionPlan => planOf(steps.map((step) => ({ step, items: [] })))

/** The imagination's actions; the strings don't say who supplied them (mine: the system). */
export const planFromActions = (actions: readonly string[]): ActionPlan =>
    planFromCandidateSteps(actions.map((says) => ({ says, suppliedBy: 'system' })))

/**
 * The trial's steps (AP-7): an intended step right after a method step becomes, on that step, an intent and an intended consequence of
 * its text, before the step's own lines. An intended step with no method step before it stays a step, with an intent of its own text.
 * Each `consequences` line is an unintended consequence. Who supplied a step isn't said (mine: the system).
 */
export const planFromNonRuleSteps = (steps: readonly NonRuleStep[]): ActionPlan => {
    const built = steps.reduce<{ step: CandidateStep; role: NonRuleStep['role']; intent?: string; lines: readonly string[] }[]>((acc, { says, role, consequences = [] }) => {
        const last = acc[acc.length - 1]
        if (role === 'intended' && last?.role === 'method') {
            if (last.intent !== undefined) {
                throw new Error(`One intent per step: "${says}" follows "${last.step.says}", which already has "${last.intent}"`)
            }
            return [...acc.slice(0, -1), { ...last, intent: says, lines: [...last.lines, ...consequences] }]
        }
        return [...acc, { step: { says, suppliedBy: 'system' }, role, ...(role === 'intended' ? { intent: says } : {}), lines: consequences }]
    }, [])
    return planOf(built.map(({ step, role, intent, lines }) => ({
        step,
        items: [
            ...(intent === undefined ? [] : [{ kind: 'intent' as const, says: intent }]),
            ...(intent === undefined || role === 'intended' ? [] : [{ kind: 'consequence' as const, says: intent, intended: true as const }]),
            ...lines.map((says) => ({ kind: 'consequence' as const, says })),
        ],
    })))
}

/** A plan for a generator to read: a line per step, its items indented under it, each with its kind and path. */
export const renderPlanForGenerator = ({ steps }: ActionPlan): string => steps.flatMap(({ path, says, items }) => [
    `Step ${path}: ${says}`,
    ...items.map((item) => `  - ${item.kind}${item.kind === 'consequence' && item.intended ? ' (intended)' : ''} ${item.path}: ${item.says}`),
]).join('\n')
