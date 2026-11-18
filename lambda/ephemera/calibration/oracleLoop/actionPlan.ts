//
// The action plan (AGENT.actionPlan.planning.md, step 1, a Prototype): a candidate step with a path and its sub-items, built from each
// step shape in use, and a render for a generator to read. No piece reads it yet, and every existing render reads its own inputs.
// Paths are readable slugs minted at creation (AP-2); with additions only, a path never changes, so it is the item's id.
// Step 2 adds the change language: a block of additions, merged in by code, the whole block refused on any problem.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { replyJsonObject, type StageContract } from '../../llm/stageContract'
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

/**
 * Each text's slug in one scope, in order: the slug if it is free, else the first free `-2`, `-3`. `taken` holds the scope's paths
 * already minted, so a merge never reuses one; checking what is taken, not counting slugs, also keeps a text that slugs to `x-2` apart.
 */
export const mintPaths = (texts: readonly { says: string; fallback: string }[], taken: readonly string[] = []): string[] =>
    texts.reduce<{ paths: string[]; used: ReadonlySet<string> }>(({ paths, used }, { says, fallback }) => {
        const base = slug(says, fallback)
        const numbered = (count: number): string => (used.has(`${base}-${count}`) ? numbered(count + 1) : `${base}-${count}`)
        const path = used.has(base) ? numbered(2) : base
        return { paths: [...paths, path], used: new Set([...used, path]) }
    }, { paths: [], used: new Set(taken) }).paths

/** Items by kind (intent, consequence, concern), and within a kind in the order given: a stable sort. */
export const orderItems = <Item extends { kind: StepItemKind }>(items: readonly Item[]): Item[] =>
    STEP_ITEM_KINDS.flatMap((kind) => items.filter((item) => item.kind === kind))

/** An item before its path is minted. */
export type UnmintedItem = StepItem extends infer Item ? (Item extends StepItem ? Omit<Item, 'path'> : never) : never

/** A step's items ordered, then each path minted under the step's, in one scope across kinds. */
const mintItems = (stepPath: string, items: readonly UnmintedItem[]): StepItem[] => {
    const ordered = orderItems(items)
    const paths = mintPaths(ordered.map(({ kind, says }) => ({ says, fallback: kind })))
    return ordered.map((item, index) => ({ ...item, path: `${stepPath}.${paths[index]}` }) as StepItem)
}

/** Steps with their items: each step's path minted, then each item's under it, ordered by kind (for a builder outside this file). */
export const planOf = (steps: readonly { step: CandidateStep; items: readonly UnmintedItem[] }[]): ActionPlan => {
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

/** A change once checked (AP-4: sub-items only, unintended only). The model names only the step it adds to; the merge mints the path. */
export type PlanChange =
    | { add: 'consequence'; to: string; thing?: SceneHandle; says: string }
    | { add: 'concern'; to: string; says: string }

/** What a change block is merged against: the plan, and the scene's handles, which the plan doesn't hold (mine: step 0 typed it as the plan alone). */
export type PlanChangesInput = { plan: ActionPlan; handles: readonly SceneHandle[] }

const CHANGE_KEYS = ['add', 'to', 'thing', 'says']
const CHANGE_KINDS = ['consequence', 'concern']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** One change checked against the plan's paths and the scene's handles: the change, or every problem with it. */
const checkChange = (
    entry: unknown,
    { stepPaths, itemPaths, handles }: { stepPaths: ReadonlySet<string>; itemPaths: ReadonlySet<string>; handles: readonly SceneHandle[] },
): { change: PlanChange } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    const { add, to, thing, says } = entry
    const extra = Object.keys(entry).filter((key) => !CHANGE_KEYS.includes(key))
    const target = typeof to === 'string' ? to.trim() : undefined
    const handle = typeof thing === 'string' ? thing.trim().replace(/^\[(.*)\]$/, '$1').trim() : undefined
    const problems = [
        ...extra.map((key) => (key === 'intended' ? '"intended" isn\'t writable: a change adds only unintended consequences' : `has "${key}", not one of ${CHANGE_KEYS.join(', ')}`)),
        ...(typeof add === 'string' && CHANGE_KINDS.includes(add) ? [] : [`"add" must be one of ${CHANGE_KINDS.join(', ')}`]),
        ...(target === undefined
            ? ['has no string "to"']
            : stepPaths.has(target) ? [] : itemPaths.has(target) ? [`to "${target}" names a sub-item, not a step`] : [`to "${target}" names no step`]),
        ...(thing === undefined ? [] : handle === undefined ? ['"thing" is not a string'] : handles.includes(handle) ? [] : [`thing "${handle}" is not in the scene`]),
        ...(add === 'concern' && thing !== undefined ? ['a concern takes no "thing"'] : []),
        ...(typeof says === 'string' && says.trim() !== '' ? [] : ['has no non-empty string "says"']),
    ]
    if (problems.length > 0 || target === undefined || typeof says !== 'string') {
        return { problems }
    }
    return { change: add === 'concern' ? { add, to: target, says } : { add: 'consequence', to: target, ...(handle === undefined ? {} : { thing: handle }), says } }
}

/**
 * A change block merged into a plan (AP-3, AP-6): each addition minted under its step, against the step's paths already taken, and placed
 * by the order rule; existing items and paths unchanged. The whole block is refused on any problem, with every problem listed.
 */
export const mergeChanges = (plan: ActionPlan, block: unknown, handles: readonly SceneHandle[]): { plan: ActionPlan } | { problems: string[] } => {
    const changes = isRecord(block) ? block.changes : undefined
    if (!Array.isArray(changes)) {
        return { problems: [isRecord(block) ? 'the JSON block has no "changes" array' : 'the change block is not an object'] }
    }
    const stepPaths = new Set(plan.steps.map(({ path }) => path))
    const itemPaths = new Set(plan.steps.flatMap(({ items }) => items.map(({ path }) => path)))
    const checked = changes.map((entry) => checkChange(entry, { stepPaths, itemPaths, handles }))
    const problems = checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `change ${index + 1}: ${problem}`) : []))
    if (problems.length > 0) {
        return { problems }
    }
    const accepted = checked.flatMap((result) => ('change' in result ? [result.change] : []))
    return {
        plan: {
            steps: plan.steps.map((step) => {
                const added = accepted.filter(({ to }) => to === step.path)
                if (added.length === 0) {
                    return step
                }
                const paths = mintPaths(added.map(({ add, says }) => ({ says, fallback: add })), step.items.map(({ path }) => path.slice(step.path.length + 1)))
                const items = added.map((change, index): StepItem => {
                    const path = `${step.path}.${paths[index]}`
                    return change.add === 'concern'
                        ? { kind: 'concern', path, says: change.says }
                        : { kind: 'consequence', path, says: change.says, ...(change.thing === undefined ? {} : { thing: change.thing }) }
                })
                return { ...step, items: orderItems([...step.items, ...items]) }
            }),
        },
    }
}

/** A reply in the change language: its trailing JSON block, merged into the plan shown (`mergeChanges`). */
export const planChangesContract: StageContract<PlanChangesInput, ActionPlan> = {
    name: 'plan changes',
    parse: (reply, { input: { plan, handles } }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const merged = mergeChanges(plan, parsed.object, handles)
        return 'problems' in merged ? merged : { value: merged.plan }
    },
}
