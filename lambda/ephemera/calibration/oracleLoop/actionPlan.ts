//
// The action plan, a Prototype (calibration AGENT.md, "The action plan"): a candidate step with a path and its sub-items, built from each
// step shape in use, and a render for a generator to read. The judging pieces don't read it yet; they render from their own inputs.
// Paths are readable slugs minted at creation; with additions only, a path never changes, so it is the item's id.
// A change language adds to it: a block of additions, merged in by code, the whole block refused on any problem.
// A possibility holds a spread of outcomes, as unlabelled branches of consequences. Every path is flat under its step, in one scope at
// any depth; consequences and concerns slug their text, every other kind its kind (`tip-table1.intent`, `.maybe-2`).
// A step expands in place into sub-steps, each a `step` item holding its own items: the one exception to the path rule, since a
// sub-step's path is a step path, minted in the plan's one scope of step paths at any depth (calibration AGENT.md, "The action plan").
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { replyJsonObject, type StageContract } from '../../llm/stageContract'
import type { NonRuleStep } from '../oraclePieces/nonRuleCell'
import type { CandidateStep } from './oracleInputs'

/** The kinds of openness a possibility can have: `execution`, whether the actor manages what the condition says. */
export const OPENNESS_KINDS = ['execution'] as const
export type Openness = typeof OPENNESS_KINDS[number]

/** A consequence within a branch: it happens only in that branch (the user, 2026-11-18). Never intended, as no change writes one. */
export type BranchConsequence = { kind: 'consequence'; path: string; says: string; thing?: SceneHandle }

/** One outcome of a possibility, unlabelled: an adjudicator reads from its consequences which branch is the intended one. */
export type Branch = { kind: 'maybe'; path: string; items: readonly BranchConsequence[] }

export type StepItem =
    | { kind: 'intent'; path: string; says: string }
    | { kind: 'consequence'; path: string; says: string; thing?: SceneHandle; intended?: true }
    /** A spread of outcomes: what is open (`says`, the condition), and the branches it may fall into. A flat consequence beside it happens in every branch. */
    | { kind: 'possibility'; path: string; openness: Openness; says: string; branches: readonly Branch[] }
    /** The imagination's "possible problem": a deferral the oracle classifies, not a judge's claim. */
    | { kind: 'concern'; path: string; says: string }
    | SubStep

/**
 * A sub-step: a full planned step inside its parent, in order, from an expansion. Its path is a step path (flat, in the plan's step scope),
 * and its items are in its own scope. `atomic`: marked as one motion, so nothing expands it.
 */
export type SubStep = { kind: 'step'; path: string; says: string; suppliedBy: 'system'; atomic?: true; items: readonly StepItem[] }

export type StepItemKind = StepItem['kind']

/**
 * The order of kinds within a step: what it's for, how it's done, then what happens. A possibility after the flat consequences,
 * which happen however it falls (mine).
 */
export const STEP_ITEM_KINDS: readonly StepItemKind[] = ['intent', 'step', 'consequence', 'possibility', 'concern']

/** Every text an item holds, its branches' and its sub-steps' included, in order. */
export const itemTexts = (item: StepItem): string[] =>
    item.kind === 'possibility' ? [item.says, ...item.branches.flatMap(({ items }) => items.map(({ says }) => says))]
        : item.kind === 'step' ? [item.says, ...item.items.flatMap(itemTexts)]
        : [item.says]

/** Every path an item holds, its branches' and their consequences', and a sub-step's with all of its items'. */
export const itemPaths = (item: StepItem): string[] =>
    item.kind === 'possibility' ? [item.path, ...item.branches.flatMap(({ path, items }) => [path, ...items.map((consequence) => consequence.path)])]
        : item.kind === 'step' ? [item.path, ...item.items.flatMap(itemPaths)]
        : [item.path]

/** A step's `atomic`: marked as one motion (set once, by a reply), so nothing expands it. A step is expanded, or atomic, or neither. */
export type PlannedStep = CandidateStep & { path: string; atomic?: true; items: readonly StepItem[] }

/** What a planned step and a sub-step share: enough to find, expand or mark either. */
export type StepNode = { path: string; says: string; atomic?: true; items: readonly StepItem[] }

/** A step and its sub-steps at every depth, depth first. */
const withSubSteps = (step: StepNode): StepNode[] => [step, ...step.items.flatMap((item) => (item.kind === 'step' ? withSubSteps(item) : []))]

/** Every step in the plan at any depth, depth first: the plan's one scope of step paths. */
export const planSteps = ({ steps }: ActionPlan): StepNode[] => steps.flatMap(withSubSteps)

/** A step's own scope: the paths of its items other than sub-steps, a possibility's included. A sub-step's are in its own scope. */
const scopePaths = (items: readonly StepItem[]): string[] => items.filter(({ kind }) => kind !== 'step').flatMap(itemPaths)

/** Whether a step is expanded: it holds sub-steps. */
export const isExpanded = ({ items }: Pick<StepNode, 'items'>): boolean => items.some(({ kind }) => kind === 'step')

/** A step, with the one step at `path` (itself or a sub-step at any depth) given what `change` returns; every other part kept as it is. */
const mapStep = <Step extends StepNode>(step: Step, path: string, change: (step: StepNode) => Pick<StepNode, 'items' | 'atomic'>): Step => {
    if (step.path === path) {
        return { ...step, ...change(step) }
    }
    const items = step.items.map((item) => (item.kind === 'step' ? mapStep(item, path, change) : item))
    return items.every((item, index) => item === step.items[index]) ? step : { ...step, items }
}

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

/** An item a builder gives, before its path is minted. Possibilities come only from changes, so no builder takes one (mine). */
export type UnmintedItem =
    | { kind: 'intent'; says: string }
    | { kind: 'consequence'; says: string; thing?: SceneHandle; intended?: true }
    | { kind: 'concern'; says: string }

/** What a path is minted from: a consequence's or a concern's text, or else the kind itself (`intent`, `execution`, `maybe`). */
const pathSource = (kind: 'intent' | 'consequence' | 'concern' | 'maybe' | Openness, says: string): { says: string; fallback: string } =>
    kind === 'consequence' || kind === 'concern' ? { says, fallback: kind } : { says: kind, fallback: kind }

/** A step's items ordered, then each path minted under the step's, in one scope across kinds. */
const mintItems = (stepPath: string, items: readonly UnmintedItem[]): StepItem[] => {
    const ordered = orderItems(items)
    const paths = mintPaths(ordered.map(({ kind, says }) => pathSource(kind, says)))
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
 * The trial's steps: an intended step right after a method step becomes, on that step, an intent and an intended consequence of
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

/**
 * A text with each bare handle bracketed: `teapot1` becomes `[teapot1]`, as every prompt writes it (CQ-P5, in
 * `consequences`' drafts). A handle matches whole, in any case, and is written as the handle; one already in brackets is left. A letter-and-number
 * word that matches a handle is always the thing (the user, 2026-11-18), so the repair is safe.
 */
export const bracketHandles = (text: string, handles: readonly SceneHandle[]): string => {
    const escaped = [...new Set(handles)].sort((a, b) => b.length - a.length).map((handle) => handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    if (escaped.length === 0) {
        return text
    }
    const canonical = new Map(handles.map((handle) => [handle.toLowerCase(), handle]))
    return text.replace(new RegExp(`(?<![\\[\\w])(${escaped.join('|')})(?![\\]\\w])`, 'gi'), (match) => `[${canonical.get(match.toLowerCase()) ?? match}]`)
}

/** ` (atomic)` on a step marked as one motion, as `(intended)` on an intended consequence. */
const atomicTag = (atomic?: true): string => (atomic ? ' (atomic)' : '')

/** An item's lines in the generator's render: one indent per level, so a possibility's branches and a sub-step's items sit under it. */
const itemLines = (item: StepItem, depth = 1): string[] => {
    const indent = '  '.repeat(depth)
    if (item.kind === 'step') {
        return [`${indent}- step ${item.path}${atomicTag(item.atomic)}: ${item.says}`, ...item.items.flatMap((inner) => itemLines(inner, depth + 1))]
    }
    if (item.kind !== 'possibility') {
        return [`${indent}- ${item.kind}${item.kind === 'consequence' && item.intended ? ' (intended)' : ''} ${item.path}: ${item.says}`]
    }
    return [
        `${indent}- possibility (${item.openness}) ${item.path}: ${item.says}`,
        ...item.branches.flatMap(({ path, items }) => [`${indent}  - maybe ${path}:`, ...items.map((consequence) => `${indent}    - consequence ${consequence.path}: ${consequence.says}`)]),
    ]
}

/** A plan for a generator to read: a line per step, its items indented under it, each with its kind and path, sub-steps nested. */
export const renderPlanForGenerator = ({ steps }: ActionPlan): string => steps.flatMap(({ path, says, atomic, items }) => [
    `Step ${path}${atomicTag(atomic)}: ${says}`,
    ...items.flatMap((item) => itemLines(item)),
]).join('\n')

/** One sub-step of an expansion, as written: what is done, and optionally what it is for. */
export type SubStepEntry = { says: string; intent?: string }

/** An addition once checked: sub-items only, consequences never intended. The model names only the step it adds to; the merge mints the path. */
export type PlanAddition =
    | { add: 'consequence'; to: string; thing?: SceneHandle; says: string }
    | { add: 'concern'; to: string; says: string }
    /** The whole group in one change: each branch a list of consequences, written as flat ones are. */
    | { add: 'possibility'; to: string; openness: Openness; says: string; branches: readonly (readonly { thing?: SceneHandle; says: string }[])[] }
    /** An expansion: the step's sub-steps in order, at least two. */
    | { add: 'steps'; to: string; steps: readonly SubStepEntry[] }

/** A once-only tag set on a step: `atomic`, marked as one motion. The one change that isn't an addition; nothing moves. */
export type PlanMark = { mark: 'atomic'; to: string }

/** A change once checked. */
export type PlanChange = PlanAddition | PlanMark

export type AddKind = PlanAddition['add']
export type MarkKind = PlanMark['mark']

const ADD_KINDS: readonly AddKind[] = ['consequence', 'concern', 'possibility', 'steps']
const MARK_KINDS: readonly MarkKind[] = ['atomic']

/** The additions a block takes by default: the sub-item kinds (`consequences`'), with no expansion and no mark. */
export const SUB_ITEM_ADDS: readonly AddKind[] = ['consequence', 'concern', 'possibility']

/** What a merge holds to a step's own items, as against an expansion or a mark. */
type ItemAddition = Exclude<PlanAddition, { add: 'steps' }>

const isMark = (change: PlanChange): change is PlanMark => 'mark' in change
const isExpansion = (change: PlanChange): change is Extract<PlanAddition, { add: 'steps' }> => !isMark(change) && change.add === 'steps'
const isItemAddition = (change: PlanChange): change is ItemAddition => !isMark(change) && change.add !== 'steps'

/** What a change block is merged against: the plan, and the scene's handles, which the plan doesn't hold (mine). */
export type PlanChangesInput = { plan: ActionPlan; handles: readonly SceneHandle[] }

const CHANGE_KEYS = ['add', 'to', 'thing', 'says']
const POSSIBILITY_KEYS = ['add', 'to', 'kind', 'says', 'branches']
const STEPS_KEYS = ['add', 'to', 'steps']
const MARK_KEYS = ['mark', 'to']
const BRANCH_KEYS = ['add', 'thing', 'says']
const SUB_STEP_KEYS = ['says', 'intent']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * What a merge takes, and how it words a refusal:
 * - `handlesAre`: what a `thing` outside the handles is, `in the scene` when the handles are the scene's (the default), or as the caller
 *   names its handles, such as `a listed thing or named by the step` for `consequences`;
 * - `adds`: the additions it takes, by default the sub-item kinds (`SUB_ITEM_ADDS`); `playByPlay` takes only `steps`;
 * - `marks`: the marks it takes, by default none; `playByPlay` takes `atomic`.
 */
export type MergeOptions = { handlesAre?: string; adds?: readonly AddKind[]; marks?: readonly MarkKind[] }

type CheckContext = {
    stepPaths: ReadonlySet<string>
    itemPaths: ReadonlySet<string>
    handles: readonly SceneHandle[]
    handlesAre: string
    adds: readonly AddKind[]
    marks: readonly MarkKind[]
}

const handleOf = (thing: unknown): string | undefined => (typeof thing === 'string' ? thing.trim().replace(/^\[(.*)\]$/, '$1').trim() : undefined)

const thingProblems = (thing: unknown, { handles, handlesAre }: CheckContext): string[] => {
    const handle = handleOf(thing)
    return thing === undefined ? [] : handle === undefined ? ['"thing" is not a string'] : handles.includes(handle) ? [] : [`thing "${handle}" is not ${handlesAre}`]
}

const saysProblems = (says: unknown): string[] => (typeof says === 'string' && says.trim() !== '' ? [] : ['has no non-empty string "says"'])

const extraKeyProblems = (entry: Record<string, unknown>, keys: readonly string[]): string[] =>
    Object.keys(entry).filter((key) => !keys.includes(key)).map((key) => `has "${key}", not one of ${keys.join(', ')}`)

/** A `to`'s problems: none when it names a step at any depth. */
const targetProblems = (target: string | undefined, { stepPaths, itemPaths }: CheckContext): string[] =>
    target === undefined ? ['has no string "to"']
        : stepPaths.has(target) ? [] : itemPaths.has(target) ? [`to "${target}" names a sub-item, not a step`] : [`to "${target}" names no step`]

/** One consequence in a branch: written as a flat one is, `add` optional; a concern has no place in a branch. */
const checkBranchEntry = (entry: unknown, context: CheckContext): { consequence: { thing?: SceneHandle; says: string } } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    const { add, thing, says } = entry
    const problems = [
        ...extraKeyProblems(entry, BRANCH_KEYS),
        ...(add === undefined || add === 'consequence'
            ? []
            : add === 'concern' ? ['a branch holds no concern: a branch in which the intent fails already is one'] : ['"add" in a branch must be consequence']),
        ...thingProblems(thing, context),
        ...saysProblems(says),
    ]
    const handle = handleOf(thing)
    return problems.length > 0 || typeof says !== 'string' ? { problems } : { consequence: { ...(handle === undefined ? {} : { thing: handle }), says } }
}

/** A possibility's own problems and its branches': at least two branches, each a list (an empty one allowed), each entry a consequence. */
const checkBranches = (branches: unknown, context: CheckContext): { branches: { thing?: SceneHandle; says: string }[][] } | { problems: string[] } => {
    if (!Array.isArray(branches)) {
        return { problems: ['has no "branches" list'] }
    }
    const checked = branches.map((branch) => (Array.isArray(branch) ? branch.map((entry) => checkBranchEntry(entry, context)) : undefined))
    const problems = [
        ...(branches.length >= 2 ? [] : [`has ${branches.length} branch${branches.length === 1 ? '' : 'es'}; a possibility needs at least two`]),
        ...checked.flatMap((entries, index) => (entries === undefined
            ? [`branch ${index + 1} is not a list`]
            : entries.flatMap((result, entry) => ('problems' in result ? result.problems.map((problem) => `branch ${index + 1}, entry ${entry + 1}: ${problem}`) : [])))),
    ]
    return problems.length > 0
        ? { problems }
        : { branches: checked.map((entries) => (entries ?? []).flatMap((result) => ('consequence' in result ? [result.consequence] : []))) }
}

/**
 * An expansion's sub-steps: a list of at least two (the user), each an object with a non-empty `says` and, where it helps, a
 * non-empty `intent` (the user). No `thing` is checked: a sub-step may improvise an object (the user, 2026-11-18).
 */
const checkSubSteps = (steps: unknown): { steps: SubStepEntry[] } | { problems: string[] } => {
    if (!Array.isArray(steps)) {
        return { problems: ['has no "steps" list'] }
    }
    const problems = [
        ...(steps.length >= 2 ? [] : [`has ${steps.length} sub-step${steps.length === 1 ? '' : 's'}; an expansion needs at least two`]),
        ...steps.flatMap((entry, index) => (isRecord(entry)
            ? [
                ...extraKeyProblems(entry, SUB_STEP_KEYS),
                ...saysProblems(entry.says),
                ...(entry.intent === undefined || (typeof entry.intent === 'string' && entry.intent.trim() !== '') ? [] : ['"intent" is not a non-empty string']),
            ]
            : ['is not an object']).map((problem) => `sub-step ${index + 1}: ${problem}`)),
    ]
    return problems.length > 0
        ? { problems }
        : { steps: steps.filter(isRecord).map(({ says, intent }) => ({ says: says as string, ...(typeof intent === 'string' ? { intent } : {}) })) }
}

/** A mark checked: one the merge takes, and a `to` naming a step. */
const checkMark = (entry: Record<string, unknown>, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    const { mark, to } = entry
    const target = typeof to === 'string' ? to.trim() : undefined
    const problems = [
        ...extraKeyProblems(entry, MARK_KEYS),
        ...(typeof mark === 'string' && (context.marks as readonly string[]).includes(mark)
            ? []
            : [context.marks.length === 0 ? '"mark" isn\'t a change this block takes' : `"mark" must be one of ${context.marks.join(', ')}`]),
        ...targetProblems(target, context),
    ]
    return problems.length > 0 || target === undefined ? { problems } : { change: { mark: 'atomic', to: target } }
}

/** One change checked against the plan's paths, the handles and what the merge takes: the change, or every problem with it. */
const checkChange = (entry: unknown, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    if ('mark' in entry) {
        return checkMark(entry, context)
    }
    const { add, to, thing, says } = entry
    const keys = add === 'possibility' ? POSSIBILITY_KEYS : add === 'steps' ? STEPS_KEYS : CHANGE_KEYS
    const target = typeof to === 'string' ? to.trim() : undefined
    const branches = add === 'possibility' ? checkBranches(entry.branches, context) : undefined
    const steps = add === 'steps' ? checkSubSteps(entry.steps) : undefined
    const problems = [
        ...Object.keys(entry).filter((key) => !keys.includes(key))
            .map((key) => (key === 'intended' ? '"intended" isn\'t writable: a change adds only unintended consequences' : `has "${key}", not one of ${keys.join(', ')}`)),
        ...(typeof add === 'string' && (context.adds as readonly string[]).includes(add) ? [] : [`"add" must be one of ${context.adds.join(', ')}`]),
        ...targetProblems(target, context),
        ...(add === 'possibility' || add === 'steps' ? [] : thingProblems(thing, context)),
        ...(add === 'concern' && thing !== undefined ? ['a concern takes no "thing"'] : []),
        ...(add === 'possibility' && !(OPENNESS_KINDS as readonly unknown[]).includes(entry.kind) ? [`"kind" must be one of ${OPENNESS_KINDS.join(', ')}`] : []),
        ...(add === 'steps' ? [] : saysProblems(says)),
        ...(branches !== undefined && 'problems' in branches ? branches.problems : []),
        ...(steps !== undefined && 'problems' in steps ? steps.problems : []),
    ]
    if (problems.length > 0 || target === undefined) {
        return { problems }
    }
    if (add === 'steps') {
        return { change: { add, to: target, steps: steps !== undefined && 'steps' in steps ? steps.steps : [] } }
    }
    if (typeof says !== 'string') {
        return { problems }
    }
    if (add === 'possibility') {
        return { change: { add, to: target, openness: entry.kind as Openness, says, branches: branches !== undefined && 'branches' in branches ? branches.branches : [] } }
    }
    const handle = handleOf(thing)
    return { change: add === 'concern' ? { add, to: target, says } : { add: 'consequence', to: target, ...(handle === undefined ? {} : { thing: handle }), says } }
}

/** What each change's paths are minted from, depth first: a possibility, then each branch and its consequences in order. */
const changeSources = (change: ItemAddition): { says: string; fallback: string }[] => (change.add === 'possibility'
    ? [pathSource(change.openness, change.says), ...change.branches.flatMap((branch) => [pathSource('maybe', ''), ...branch.map(({ says }) => pathSource('consequence', says))])]
    : [pathSource(change.add, change.says)])

/** A checked change as an item, its paths taken in order from `paths`, minted by `changeSources`' order. */
const changeItem = (change: ItemAddition, stepPath: string, paths: readonly string[]): StepItem => {
    const at = (index: number) => `${stepPath}.${paths[index]}`
    if (change.add === 'concern') {
        return { kind: 'concern', path: at(0), says: change.says }
    }
    if (change.add === 'consequence') {
        return { kind: 'consequence', path: at(0), says: change.says, ...(change.thing === undefined ? {} : { thing: change.thing }) }
    }
    const branches = change.branches.reduce<{ branches: Branch[]; next: number }>(({ branches: built, next }, branch) => ({
        branches: [...built, {
            kind: 'maybe',
            path: at(next),
            items: branch.map(({ thing, says }, index): BranchConsequence => ({ kind: 'consequence', path: at(next + 1 + index), says, ...(thing === undefined ? {} : { thing }) })),
        }],
        next: next + 1 + branch.length,
    }), { branches: [], next: 1 }).branches
    return { kind: 'possibility', path: at(0), openness: change.openness, says: change.says, branches }
}

/** A sub-step as an item: its path a step path, its intent (when given) the first item in its own scope. */
const subStepItem = ({ says, intent }: SubStepEntry, path: string): SubStep => ({
    kind: 'step', path, says, suppliedBy: 'system', items: intent === undefined ? [] : [{ kind: 'intent', path: `${path}.intent`, says: intent }],
})

type Accepted = { index: number; change: PlanChange }

/** At most one `execution` possibility per step, counting the plan's and the block's. */
const possibilityLimitProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        if (isMark(change) || change.add !== 'possibility') {
            return []
        }
        const held = steps.get(change.to)?.items.some((item) => item.kind === 'possibility' && item.openness === change.openness) ?? false
        const earlier = accepted.some((other) => other.index < index && !isMark(other.change) && other.change.add === 'possibility' && other.change.to === change.to && other.change.openness === change.openness)
        return held || earlier ? [`change ${index + 1}: step ${change.to} already has an ${change.openness} possibility; a step holds at most one`] : []
    })

/**
 * A step is expanded at most once, more detail going into its sub-steps; a step marked atomic takes no expansion; the tag is set once;
 * and a step is expanded or atomic, never both (the user, 2026-11-18). Counting the plan's and the block's earlier changes.
 */
const expansionProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        const step = steps.get(change.to)
        if (step === undefined || isItemAddition(change)) {
            return []
        }
        const earlier = (test: (other: PlanChange) => boolean) => accepted.some((other) => other.index < index && other.change.to === change.to && test(other.change))
        const both = earlier(isExpansion) || earlier(isMark) ? [`step ${change.to} is both expanded and marked atomic in this block; a step is one or the other`] : []
        const problems = isMark(change)
            ? [
                ...(step.atomic || earlier(isMark) ? [`step ${change.to} is already marked atomic`] : []),
                ...(isExpanded(step) ? [`step ${change.to} is already expanded, so it isn't one motion`] : []),
                ...(earlier(isExpansion) ? both : []),
            ]
            : [
                ...(step.atomic ? [`step ${change.to} is marked as one motion; nothing to expand`] : []),
                ...(isExpanded(step) || earlier(isExpansion) ? [`step ${change.to} is already expanded; expand one of its sub-steps for more detail`] : []),
                ...(earlier(isMark) ? both : []),
            ]
        return problems.map((problem) => `change ${index + 1}: ${problem}`)
    })

/** A step with the block's changes to it applied: additions minted in its own scope, sub-steps from `subStepPaths`, the mark set. */
const applyChanges = (step: StepNode, changes: readonly Accepted[], subStepPaths: ReadonlyMap<number, readonly string[]>): Pick<StepNode, 'items' | 'atomic'> => {
    const additions = changes.map(({ change }) => change).filter(isItemAddition)
    const sources = additions.map(changeSources)
    const paths = mintPaths(sources.flat(), scopePaths(step.items).map((path) => path.slice(step.path.length + 1)))
    const items = additions.reduce<{ items: StepItem[]; next: number }>(({ items: built, next }, change, index) => ({
        items: [...built, changeItem(change, step.path, paths.slice(next, next + sources[index].length))],
        next: next + sources[index].length,
    }), { items: [], next: 0 }).items
    const subSteps = changes.flatMap(({ index, change }) => (isExpansion(change) ? change.steps.map((entry, at) => subStepItem(entry, subStepPaths.get(index)?.[at] ?? '')) : []))
    return { items: orderItems([...step.items, ...items, ...subSteps]), ...(changes.some(({ change }) => isMark(change)) ? { atomic: true as const } : {}) }
}

/**
 * A change block merged into a plan: each addition minted under its step, against the step's paths already taken, and placed
 * by the order rule; each sub-step minted in the plan's one scope of step paths; existing items and paths unchanged. A change may
 * address a step at any depth. The whole block is refused on any problem, with every problem listed. A key
 * beside `changes` is a problem, since what it holds would otherwise be dropped unseen (`consequences`' batch 4, a `"concerns"` key).
 */
export const mergeChanges = (
    plan: ActionPlan, block: unknown, handles: readonly SceneHandle[], { handlesAre = 'in the scene', adds = SUB_ITEM_ADDS, marks = [] }: MergeOptions = {},
): { plan: ActionPlan } | { problems: string[] } => {
    const changes = isRecord(block) ? block.changes : undefined
    const besides = isRecord(block) ? Object.keys(block).filter((key) => key !== 'changes').map((key) => `the JSON block has "${key}"; everything it adds goes in "changes"`) : []
    if (!Array.isArray(changes)) {
        return { problems: [isRecord(block) ? 'the JSON block has no "changes" array' : 'the change block is not an object', ...besides] }
    }
    const steps = new Map(planSteps(plan).map((step) => [step.path, step]))
    const itemPathSet = new Set([...steps.values()].flatMap(({ items }) => scopePaths(items)))
    const checked = changes.map((entry) => checkChange(entry, { stepPaths: new Set(steps.keys()), itemPaths: itemPathSet, handles, handlesAre, adds, marks }))
    const accepted = checked.flatMap((result, index): Accepted[] => ('change' in result ? [{ index, change: result.change }] : []))
    const problems = [
        ...besides,
        ...checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `change ${index + 1}: ${problem}`) : [])),
        ...possibilityLimitProblems(steps, accepted),
        ...expansionProblems(steps, accepted),
    ]
    if (problems.length > 0) {
        return { problems }
    }
    const expansions = accepted.flatMap(({ index, change }) => (isExpansion(change) ? [{ index, steps: change.steps }] : []))
    const minted = mintPaths(expansions.flatMap(({ steps: entries }) => entries.map(({ says }) => ({ says, fallback: 'step' }))), [...steps.keys()])
    const subStepPaths = new Map(expansions.reduce<{ pairs: [number, string[]][]; next: number }>(({ pairs, next }, { index, steps: entries }) => ({
        pairs: [...pairs, [index, minted.slice(next, next + entries.length)]],
        next: next + entries.length,
    }), { pairs: [], next: 0 }).pairs)
    const targets = [...new Set(accepted.map(({ change }) => change.to))]
    return {
        plan: targets.reduce<ActionPlan>((built, target) => ({
            steps: built.steps.map((step) => mapStep(step, target, (found) => applyChanges(found, accepted.filter(({ change }) => change.to === target), subStepPaths))),
        }), plan),
    }
}

/**
 * A change block scoped to one step, the one a generator expands: code supplies each change's
 * `to`, by the rule that an id a model writes is a reference waiting to break. A `to` the block does write must name the target;
 * otherwise the block is refused, as any problem refuses it. Then `mergeChanges`. The scope reads only `to`, so a new `add`
 * kind, or a mark, passes through it to `checkChange`. The target may be a step at any depth.
 */
export const mergeStepChanges = (plan: ActionPlan, target: string, block: unknown, handles: readonly SceneHandle[], options: MergeOptions = {}): { plan: ActionPlan } | { problems: string[] } => {
    if (!planSteps(plan).some(({ path }) => path === target)) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    const changes = isRecord(block) ? block.changes : undefined
    if (!Array.isArray(changes)) {
        return mergeChanges(plan, block, handles, options)
    }
    const problems = changes.flatMap((entry, index) => {
        const to = isRecord(entry) ? entry.to : undefined
        return to === undefined || (typeof to === 'string' && to.trim() === target)
            ? []
            : [`change ${index + 1}: to ${JSON.stringify(to)} is not the step being expanded, ${target}`]
    })
    if (problems.length > 0) {
        return { problems }
    }
    return mergeChanges(plan, { ...(block as Record<string, unknown>), changes: changes.map((entry) => (isRecord(entry) ? { ...entry, to: target } : entry)) }, handles, options)
}

/** An entry with its `says` and `intent` bracketed, and a possibility's branches' entries and an expansion's sub-steps with theirs. */
const bracketEntry = (entry: unknown, handles: readonly SceneHandle[]): unknown => {
    if (!isRecord(entry)) {
        return entry
    }
    const texts = Object.fromEntries((['says', 'intent'] as const).flatMap((key) => {
        const text = entry[key]
        return typeof text === 'string' ? [[key, bracketHandles(text, handles)]] : []
    }))
    const inner = (list: unknown): unknown => (Array.isArray(list) ? list.map((item) => bracketEntry(item, handles)) : list)
    const branches = Array.isArray(entry.branches) ? { branches: entry.branches.map(inner) } : {}
    const steps = Array.isArray(entry.steps) ? { steps: inner(entry.steps) } : {}
    return { ...entry, ...texts, ...branches, ...steps }
}

/**
 * A block with each change's texts repaired: bare handles bracketed (`bracketHandles`, CQ-P5), against every handle the prompt names.
 * Anything else is left for the merge to check.
 */
export const bracketChanges = (block: Record<string, unknown>, handles: readonly SceneHandle[]): Record<string, unknown> => {
    const { changes } = block
    return Array.isArray(changes) ? { ...block, changes: changes.map((entry) => bracketEntry(entry, handles)) } : block
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
