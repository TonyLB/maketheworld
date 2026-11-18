//
// The action plan (AGENT.actionPlan.planning.md, step 1, a Prototype): a candidate step with a path and its sub-items, built from each
// step shape in use, and a render for a generator to read. No piece reads it yet, and every existing render reads its own inputs.
// Paths are readable slugs minted at creation (AP-2); with additions only, a path never changes, so it is the item's id.
// Step 2 adds the change language: a block of additions, merged in by code, the whole block refused on any problem.
// Step 5 adds possibilities: a spread of outcomes, as unlabelled branches of consequences (AP-8). Every path is flat under its step, in
// one scope at any depth; consequences and concerns slug their text, every other kind its kind (`tip-table1.intent`, `.maybe-2`).
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { replyJsonObject, type StageContract } from '../../llm/stageContract'
import type { NonRuleStep } from '../oraclePieces/nonRuleCell'
import type { CandidateStep } from './oracleInputs'

/** The kinds of openness a possibility can have (step 5): `execution`, whether the actor manages what the condition says. */
export const OPENNESS_KINDS = ['execution'] as const
export type Openness = typeof OPENNESS_KINDS[number]

/** A consequence within a branch: it happens only in that branch (the user, 2026-11-18). Never intended, as no change writes one. */
export type BranchConsequence = { kind: 'consequence'; path: string; says: string; thing?: SceneHandle }

/** One outcome of a possibility, unlabelled (AP-8): an adjudicator reads from its consequences which branch is the intended one. */
export type Branch = { kind: 'maybe'; path: string; items: readonly BranchConsequence[] }

export type StepItem =
    | { kind: 'intent'; path: string; says: string }
    | { kind: 'consequence'; path: string; says: string; thing?: SceneHandle; intended?: true }
    /** A spread of outcomes: what is open (`says`, the condition), and the branches it may fall into. A flat consequence beside it happens in every branch. */
    | { kind: 'possibility'; path: string; openness: Openness; says: string; branches: readonly Branch[] }
    /** The imagination's "possible problem": a deferral the oracle classifies, not a judge's claim. */
    | { kind: 'concern'; path: string; says: string }

export type StepItemKind = StepItem['kind']

/** The order of kinds within a step (AP-3); a possibility after the flat consequences, which happen however it falls (mine). */
export const STEP_ITEM_KINDS: readonly StepItemKind[] = ['intent', 'consequence', 'possibility', 'concern']

/** Every text an item holds, its branches' included, in order. */
export const itemTexts = (item: StepItem): string[] =>
    item.kind === 'possibility' ? [item.says, ...item.branches.flatMap(({ items }) => items.map(({ says }) => says))] : [item.says]

/** Every path an item holds, its branches' and their consequences' included: all in the step's one scope. */
export const itemPaths = (item: StepItem): string[] =>
    item.kind === 'possibility' ? [item.path, ...item.branches.flatMap(({ path, items }) => [path, ...items.map((consequence) => consequence.path)])] : [item.path]

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

/** An item a builder gives, before its path is minted. Possibilities come only from changes, so no builder takes one (mine). */
export type UnmintedItem =
    | { kind: 'intent'; says: string }
    | { kind: 'consequence'; says: string; thing?: SceneHandle; intended?: true }
    | { kind: 'concern'; says: string }

/** What a path is minted from (step 5): a consequence's or a concern's text, or else the kind itself (`intent`, `execution`, `maybe`). */
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

/**
 * A text with each bare handle bracketed: `teapot1` becomes `[teapot1]`, as every prompt writes it (AGENT.actionPlan.planning.md, step
 * 4b, CQ-P5). A handle matches whole, in any case, and is written as the handle; one already in brackets is left. A letter-and-number
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

/** An item's lines in the generator's render: one indent per level, so a possibility's branches sit under it (step 5). */
const itemLines = (item: StepItem): string[] => {
    if (item.kind !== 'possibility') {
        return [`  - ${item.kind}${item.kind === 'consequence' && item.intended ? ' (intended)' : ''} ${item.path}: ${item.says}`]
    }
    return [
        `  - possibility (${item.openness}) ${item.path}: ${item.says}`,
        ...item.branches.flatMap(({ path, items }) => [`    - maybe ${path}:`, ...items.map((consequence) => `      - consequence ${consequence.path}: ${consequence.says}`)]),
    ]
}

/** A plan for a generator to read: a line per step, its items indented under it, each with its kind and path. */
export const renderPlanForGenerator = ({ steps }: ActionPlan): string => steps.flatMap(({ path, says, items }) => [
    `Step ${path}: ${says}`,
    ...items.flatMap(itemLines),
]).join('\n')

/** A change once checked (AP-4: sub-items only, unintended only). The model names only the step it adds to; the merge mints the path. */
export type PlanChange =
    | { add: 'consequence'; to: string; thing?: SceneHandle; says: string }
    | { add: 'concern'; to: string; says: string }
    /** The whole group in one change (step 5): each branch a list of consequences, written as flat ones are. */
    | { add: 'possibility'; to: string; openness: Openness; says: string; branches: readonly (readonly { thing?: SceneHandle; says: string }[])[] }

/** What a change block is merged against: the plan, and the scene's handles, which the plan doesn't hold (mine: step 0 typed it as the plan alone). */
export type PlanChangesInput = { plan: ActionPlan; handles: readonly SceneHandle[] }

const CHANGE_KEYS = ['add', 'to', 'thing', 'says']
const POSSIBILITY_KEYS = ['add', 'to', 'kind', 'says', 'branches']
const BRANCH_KEYS = ['add', 'thing', 'says']
const CHANGE_KINDS = ['consequence', 'concern', 'possibility']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * What a `thing` outside the handles is, in a refusal: `in the scene` when the handles are the scene's (the default), or as the caller
 * names its handles, such as `a listed thing` for `consequences`, whose handles are the things it lists (step 4b).
 */
export type MergeOptions = { handlesAre?: string }

type CheckContext = { stepPaths: ReadonlySet<string>; itemPaths: ReadonlySet<string>; handles: readonly SceneHandle[]; handlesAre: string }

const handleOf = (thing: unknown): string | undefined => (typeof thing === 'string' ? thing.trim().replace(/^\[(.*)\]$/, '$1').trim() : undefined)

const thingProblems = (thing: unknown, { handles, handlesAre }: CheckContext): string[] => {
    const handle = handleOf(thing)
    return thing === undefined ? [] : handle === undefined ? ['"thing" is not a string'] : handles.includes(handle) ? [] : [`thing "${handle}" is not ${handlesAre}`]
}

const saysProblems = (says: unknown): string[] => (typeof says === 'string' && says.trim() !== '' ? [] : ['has no non-empty string "says"'])

/** One consequence in a branch: written as a flat one is, `add` optional; a concern has no place in a branch (step 5's refusals). */
const checkBranchEntry = (entry: unknown, context: CheckContext): { consequence: { thing?: SceneHandle; says: string } } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    const { add, thing, says } = entry
    const problems = [
        ...Object.keys(entry).filter((key) => !BRANCH_KEYS.includes(key)).map((key) => `has "${key}", not one of ${BRANCH_KEYS.join(', ')}`),
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

/** One change checked against the plan's paths and the handles: the change, or every problem with it. */
const checkChange = (entry: unknown, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    const { stepPaths, itemPaths } = context
    const { add, to, thing, says } = entry
    const keys = add === 'possibility' ? POSSIBILITY_KEYS : CHANGE_KEYS
    const extra = Object.keys(entry).filter((key) => !keys.includes(key))
    const target = typeof to === 'string' ? to.trim() : undefined
    const branches = add === 'possibility' ? checkBranches(entry.branches, context) : undefined
    const problems = [
        ...extra.map((key) => (key === 'intended' ? '"intended" isn\'t writable: a change adds only unintended consequences' : `has "${key}", not one of ${keys.join(', ')}`)),
        ...(typeof add === 'string' && CHANGE_KINDS.includes(add) ? [] : [`"add" must be one of ${CHANGE_KINDS.join(', ')}`]),
        ...(target === undefined
            ? ['has no string "to"']
            : stepPaths.has(target) ? [] : itemPaths.has(target) ? [`to "${target}" names a sub-item, not a step`] : [`to "${target}" names no step`]),
        ...(add === 'possibility' ? [] : thingProblems(thing, context)),
        ...(add === 'concern' && thing !== undefined ? ['a concern takes no "thing"'] : []),
        ...(add === 'possibility' && !(OPENNESS_KINDS as readonly unknown[]).includes(entry.kind) ? [`"kind" must be one of ${OPENNESS_KINDS.join(', ')}`] : []),
        ...saysProblems(says),
        ...(branches !== undefined && 'problems' in branches ? branches.problems : []),
    ]
    if (problems.length > 0 || target === undefined || typeof says !== 'string') {
        return { problems }
    }
    if (add === 'possibility') {
        return { change: { add, to: target, openness: entry.kind as Openness, says, branches: branches !== undefined && 'branches' in branches ? branches.branches : [] } }
    }
    const handle = handleOf(thing)
    return { change: add === 'concern' ? { add, to: target, says } : { add: 'consequence', to: target, ...(handle === undefined ? {} : { thing: handle }), says } }
}

/** What each change's paths are minted from, depth first: a possibility, then each branch and its consequences in order. */
const changeSources = (change: PlanChange): { says: string; fallback: string }[] => (change.add === 'possibility'
    ? [pathSource(change.openness, change.says), ...change.branches.flatMap((branch) => [pathSource('maybe', ''), ...branch.map(({ says }) => pathSource('consequence', says))])]
    : [pathSource(change.add, change.says)])

/** A checked change as an item, its paths taken in order from `paths`, minted by `changeSources`' order. */
const changeItem = (change: PlanChange, stepPath: string, paths: readonly string[]): StepItem => {
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

/** At most one `execution` possibility per step, counting the plan's and the block's (step 5's refusals). */
const possibilityLimitProblems = (plan: ActionPlan, accepted: readonly { index: number; change: PlanChange }[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        if (change.add !== 'possibility') {
            return []
        }
        const held = plan.steps.find(({ path }) => path === change.to)?.items.some((item) => item.kind === 'possibility' && item.openness === change.openness) ?? false
        const earlier = accepted.some((other) => other.index < index && other.change.add === 'possibility' && other.change.to === change.to && other.change.openness === change.openness)
        return held || earlier ? [`change ${index + 1}: step ${change.to} already has an ${change.openness} possibility; a step holds at most one`] : []
    })

/**
 * A change block merged into a plan (AP-3, AP-6): each addition minted under its step, against the step's paths already taken, and placed
 * by the order rule; existing items and paths unchanged. The whole block is refused on any problem, with every problem listed. A key
 * beside `changes` is a problem, since what it holds would otherwise be dropped unseen (batch 4's `"concerns"`, step 4b).
 */
export const mergeChanges = (plan: ActionPlan, block: unknown, handles: readonly SceneHandle[], { handlesAre = 'in the scene' }: MergeOptions = {}): { plan: ActionPlan } | { problems: string[] } => {
    const changes = isRecord(block) ? block.changes : undefined
    const besides = isRecord(block) ? Object.keys(block).filter((key) => key !== 'changes').map((key) => `the JSON block has "${key}"; everything it adds goes in "changes"`) : []
    if (!Array.isArray(changes)) {
        return { problems: [isRecord(block) ? 'the JSON block has no "changes" array' : 'the change block is not an object', ...besides] }
    }
    const stepPaths = new Set(plan.steps.map(({ path }) => path))
    const itemPathSet = new Set(plan.steps.flatMap(({ items }) => items.flatMap(itemPaths)))
    const checked = changes.map((entry) => checkChange(entry, { stepPaths, itemPaths: itemPathSet, handles, handlesAre }))
    const accepted = checked.flatMap((result, index) => ('change' in result ? [{ index, change: result.change }] : []))
    const problems = [
        ...besides,
        ...checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `change ${index + 1}: ${problem}`) : [])),
        ...possibilityLimitProblems(plan, accepted),
    ]
    if (problems.length > 0) {
        return { problems }
    }
    return {
        plan: {
            steps: plan.steps.map((step) => {
                const added = accepted.map(({ change }) => change).filter(({ to }) => to === step.path)
                if (added.length === 0) {
                    return step
                }
                const sources = added.map(changeSources)
                const paths = mintPaths(sources.flat(), step.items.flatMap(itemPaths).map((path) => path.slice(step.path.length + 1)))
                const items = added.reduce<{ items: StepItem[]; next: number }>(({ items: built, next }, change, index) => ({
                    items: [...built, changeItem(change, step.path, paths.slice(next, next + sources[index].length))],
                    next: next + sources[index].length,
                }), { items: [], next: 0 }).items
                return { ...step, items: orderItems([...step.items, ...items]) }
            }),
        },
    }
}

/**
 * A change block scoped to one step, the one a generator expands (AGENT.actionPlan.planning.md, step 4b): code supplies each change's
 * `to`, by step 0's rule that an id a model writes is a reference waiting to break. A `to` the block does write must name the target;
 * otherwise the block is refused, as any problem refuses it. Then `mergeChanges`. The scope reads only `to`, so a new `add`
 * kind passes through it to `checkChange`.
 */
export const mergeStepChanges = (plan: ActionPlan, target: string, block: unknown, handles: readonly SceneHandle[], options: MergeOptions = {}): { plan: ActionPlan } | { problems: string[] } => {
    if (!plan.steps.some(({ path }) => path === target)) {
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
