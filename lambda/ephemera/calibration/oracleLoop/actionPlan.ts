//
// The action plan, a Prototype (calibration AGENT.md, "The action plan"): a candidate step with a path and its sub-items, built from each
// step shape in use, and a render for a generator to read. The judging pieces don't read it yet; they render from their own inputs.
// Paths are readable slugs minted at creation; changes add, set a once-only tag, or replace an unchecked item, so an item's path never
// changes while it is in the plan, and is the item's id.
// A change language adds to it: a block of additions, merged in by code, the whole block refused on any problem.
// A possibility holds a spread of outcomes, as unlabelled branches of consequences. Every path is flat under its step, in one scope at
// any depth; consequences and concerns slug their text, every other kind its kind (`tip-table1.intent`, `.maybe-2`).
// A step expands in place into sub-steps, each a `step` item holding its own items: the one exception to the path rule, since a
// sub-step's path is a step path, minted in the plan's one scope of step paths at any depth (calibration AGENT.md, "The action plan").
// Every step and item has a standing, `confirmed` or `unchecked`, which code sets from who wrote it and the authority map, never from a
// reply; a kind's authority may replace an unchecked item with a confirmed one (AGENT.itemStanding.planning.md). A `rule` item, a
// consequence's stance on one of the scene's rules, nests in the consequence it follows from.
//
import type { SceneHandle } from '../../dataSource/positions/ludicCache/sceneModel'
import { replyJsonObject, type StageContract } from '../../llm/stageContract'
import type { NonRuleStep } from '../oraclePieces/nonRuleCell'
import type { CandidateStep } from './oracleInputs'

/** The kinds of openness a possibility can have: `execution`, whether the actor manages what the condition says. */
export const OPENNESS_KINDS = ['execution'] as const
export type Openness = typeof OPENNESS_KINDS[number]

/**
 * Whether an item's authority has it (`confirmed`) or someone else proposed it and the authority hasn't checked it (`unchecked`). Every
 * step and item has one (the user, IS-1), set by code from the author and `AUTHORITY`, never by a reply.
 */
export type Standing = 'unchecked' | 'confirmed'

/** The pieces that write to a plan. */
export type PlanAuthor = 'playByPlay' | 'consequences' | 'ruleCell'

/** A consequence's stance on a rule: the consequence breaks it, or keeps it. */
export const RULE_STANCES = ['violation', 'consistent'] as const
export type RuleStance = typeof RULE_STANCES[number]

/**
 * A rule item (IS-4): a consequence's stance on one of the scene's rules, named by its handle (`judgeRules`). It nests in the consequence
 * it follows from, since a rule is kept or broken by what moves, so it can't stand alone. Its path is flat in the step's scope, and is
 * the handle itself.
 */
export type RuleItem = { kind: 'rule'; path: string; standing: Standing; rule: string; stance: RuleStance }

/** A consequence within a branch: it happens only in that branch (the user, 2026-11-18). Never intended, as no change writes one. Its possibility's standing covers it. */
export type BranchConsequence = { kind: 'consequence'; path: string; says: string; thing?: SceneHandle }

/** One outcome of a possibility, unlabelled: an adjudicator reads from its consequences which branch is the intended one. */
export type Branch = { kind: 'maybe'; path: string; items: readonly BranchConsequence[] }

/** A consequence: what happens, with the rules it bears on nested under it. */
export type ConsequenceItem = { kind: 'consequence'; path: string; standing: Standing; says: string; thing?: SceneHandle; intended?: true; rules?: readonly RuleItem[] }

export type StepItem =
    | { kind: 'intent'; path: string; standing: Standing; says: string }
    | ConsequenceItem
    /** A spread of outcomes: what is open (`says`, the condition), and the branches it may fall into. A flat consequence beside it happens in every branch. */
    | { kind: 'possibility'; path: string; standing: Standing; openness: Openness; says: string; branches: readonly Branch[] }
    /** The imagination's "possible problem": a deferral the oracle classifies, not a judge's claim. */
    | { kind: 'concern'; path: string; standing: Standing; says: string }
    | SubStep

/**
 * A sub-step: a full planned step inside its parent, in order, from an expansion. Its path is a step path (flat, in the plan's step scope),
 * and its items are in its own scope. `atomic`: marked as one motion, so nothing expands it.
 */
export type SubStep = { kind: 'step'; path: string; standing: Standing; says: string; suppliedBy: 'system'; atomic?: true; items: readonly StepItem[] }

export type StepItemKind = StepItem['kind']

/** Every kind a piece writes: the step items' and the rule's. */
export type AuthoredKind = StepItemKind | 'rule'

/**
 * Who is authoritative for each kind (IS-1, a fixed map for this iteration): the method's (a sub-step, and its intent) is `playByPlay`'s;
 * what happens is `consequences`'; a rule's stance is the rule cell's. A plan's own steps are its source's, so builders confirm them.
 */
export const AUTHORITY: Record<AuthoredKind, PlanAuthor> = {
    step: 'playByPlay', intent: 'playByPlay', consequence: 'consequences', possibility: 'consequences', concern: 'consequences', rule: 'ruleCell',
}

/** An item's standing: confirmed from its kind's authority, unchecked from anyone else. */
export const standingOf = (kind: AuthoredKind, author: PlanAuthor): Standing => (AUTHORITY[kind] === author ? 'confirmed' : 'unchecked')

/**
 * The order of kinds within a step: what it's for, how it's done, then what happens. A possibility after the flat consequences,
 * which happen however it falls (mine).
 */
export const STEP_ITEM_KINDS: readonly StepItemKind[] = ['intent', 'step', 'consequence', 'possibility', 'concern']

/** Every text an item holds, its branches' and its sub-steps' included, in order. A rule's handle is no text: it names a rule, not a thing. */
export const itemTexts = (item: StepItem): string[] =>
    item.kind === 'possibility' ? [item.says, ...item.branches.flatMap(({ items }) => items.map(({ says }) => says))]
        : item.kind === 'step' ? [item.says, ...item.items.flatMap(itemTexts)]
        : [item.says]

/** Every path an item holds, its branches' and their consequences', and a sub-step's with all of its items'. */
export const itemPaths = (item: StepItem): string[] =>
    item.kind === 'possibility' ? [item.path, ...item.branches.flatMap(({ path, items }) => [path, ...items.map((consequence) => consequence.path)])]
        : item.kind === 'step' ? [item.path, ...item.items.flatMap(itemPaths)]
        : item.kind === 'consequence' ? [item.path, ...(item.rules ?? []).map(({ path }) => path)]
        : [item.path]

/** A step's `atomic`: marked as one motion (set once, by a reply), so nothing expands it. A step is expanded, or atomic, or neither. */
export type PlannedStep = CandidateStep & { path: string; standing: Standing; atomic?: true; items: readonly StepItem[] }

/** What a planned step and a sub-step share: enough to find, expand, mark or render either. */
export type StepNode = { path: string; says: string; standing: Standing; atomic?: true; items: readonly StepItem[] }

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

/** What a path is minted from: a text to slug, or (`literal`) a base used as it is, as a rule's handle is. */
export type PathSource = { says: string; fallback: string; literal?: true }

/**
 * Each text's slug in one scope, in order: the slug if it is free, else the first free `-2`, `-3`. `taken` holds the scope's paths
 * already minted, so a merge never reuses one; checking what is taken, not counting slugs, also keeps a text that slugs to `x-2` apart.
 * A literal source is its own base, unslugged.
 */
export const mintPaths = (texts: readonly PathSource[], taken: readonly string[] = []): string[] =>
    texts.reduce<{ paths: string[]; used: ReadonlySet<string> }>(({ paths, used }, { says, fallback, literal }) => {
        const base = literal ? says : slug(says, fallback)
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
const pathSource = (kind: 'intent' | 'consequence' | 'concern' | 'maybe' | Openness, says: string): PathSource =>
    kind === 'consequence' || kind === 'concern' ? { says, fallback: kind } : { says: kind, fallback: kind }

/** A rule's path is its handle, unslugged (a slug would drop its "to"). */
const ruleSource = (rule: string): PathSource => ({ says: rule, fallback: 'rule', literal: true })

/** A step's items ordered, then each path minted under the step's, in one scope across kinds. A builder's items are its source's, so confirmed. */
const mintItems = (stepPath: string, items: readonly UnmintedItem[]): StepItem[] => {
    const ordered = orderItems(items)
    const paths = mintPaths(ordered.map(({ kind, says }) => pathSource(kind, says)))
    return ordered.map((item, index) => ({ ...item, path: `${stepPath}.${paths[index]}`, standing: 'confirmed' }) as StepItem)
}

/**
 * Steps with their items: each step's path minted, then each item's under it, ordered by kind (for a builder outside this file). A plan's
 * own steps and items are its source's, the authority for them, so every one is confirmed.
 */
export const planOf = (steps: readonly { step: CandidateStep; items: readonly UnmintedItem[] }[]): ActionPlan => {
    const paths = mintPaths(steps.map(({ step: { says } }) => ({ says, fallback: 'step' })))
    return { steps: steps.map(({ step, items }, index) => ({ ...step, path: paths[index], standing: 'confirmed', items: mintItems(paths[index], items) })) }
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

/** ` (unchecked)` after an unchecked item's path (R1, IS-1's first render candidate); a confirmed item has no tag and reads as fact. */
const uncheckedTag = (standing: Standing): string => (standing === 'unchecked' ? ' (unchecked)' : '')

const STANCE_WORDS: Record<RuleStance, string> = { violation: 'Violation', consistent: 'Consistent' }

/** A rule under its consequence: `Rule (Violation) <path>: [<handle>]` (the user's wording, IS-4). */
const ruleLine = ({ path, standing, rule, stance }: RuleItem, indent: string): string =>
    `${indent}- Rule (${STANCE_WORDS[stance]}) ${path}${uncheckedTag(standing)}: [${rule}]`

/** An item's lines in the generator's render: one indent per level, so a possibility's branches, a sub-step's items and a consequence's rules sit under it. */
const itemLines = (item: StepItem, depth = 1): string[] => {
    const indent = '  '.repeat(depth)
    if (item.kind === 'step') {
        return [`${indent}- step ${item.path}${atomicTag(item.atomic)}${uncheckedTag(item.standing)}: ${item.says}`, ...item.items.flatMap((inner) => itemLines(inner, depth + 1))]
    }
    if (item.kind === 'consequence') {
        return [
            `${indent}- consequence${item.intended ? ' (intended)' : ''} ${item.path}${uncheckedTag(item.standing)}: ${item.says}`,
            ...(item.rules ?? []).map((rule) => ruleLine(rule, `${indent}  `)),
        ]
    }
    if (item.kind !== 'possibility') {
        return [`${indent}- ${item.kind} ${item.path}${uncheckedTag(item.standing)}: ${item.says}`]
    }
    return [
        `${indent}- possibility (${item.openness}) ${item.path}${uncheckedTag(item.standing)}: ${item.says}`,
        ...item.branches.flatMap(({ path, items }) => [`${indent}  - maybe ${path}:`, ...items.map((consequence) => `${indent}    - consequence ${consequence.path}: ${consequence.says}`)]),
    ]
}

/** A plan for a generator to read: a line per step, its items indented under it, each with its kind and path, sub-steps nested. */
export const renderPlanForGenerator = ({ steps }: ActionPlan): string => steps.flatMap(({ path, says, standing, atomic, items }) => [
    `Step ${path}${atomicTag(atomic)}${uncheckedTag(standing)}: ${says}`,
    ...items.flatMap((item) => itemLines(item)),
]).join('\n')

/** A rule a consequence bears on, as written: the rule's handle, and whether the consequence breaks or keeps it. */
export type RuleEntry = { rule: string; stance: RuleStance }

/** A consequence as written, in a change, a sub-step or a replacement: what happens, optionally to what, and the rules it bears on. */
export type ConsequenceEntry = { says: string; thing?: SceneHandle; rules?: readonly RuleEntry[] }

/** One sub-step of an expansion, as written: what is done, optionally what it is for, and what that motion brings about. */
export type SubStepEntry = { says: string; intent?: string; consequences?: readonly ConsequenceEntry[] }

/** An addition once checked: sub-items only, consequences never intended. The model names only the step it adds to; the merge mints the path. */
export type PlanAddition =
    | ({ add: 'consequence'; to: string } & ConsequenceEntry)
    | { add: 'concern'; to: string; says: string }
    /** The whole group in one change: each branch a list of consequences, written as flat ones are. */
    | { add: 'possibility'; to: string; openness: Openness; says: string; branches: readonly (readonly { thing?: SceneHandle; says: string }[])[] }
    /** An expansion: the step's sub-steps in order, at least two. */
    | { add: 'steps'; to: string; steps: readonly SubStepEntry[] }

/** A once-only tag set on a step: `atomic`, marked as one motion. Nothing moves. */
export type PlanMark = { mark: 'atomic'; to: string }

/**
 * A check (IS-2): the kind's authority replaces an unchecked item with a confirmed one of the same kind, an opposite, a more nuanced
 * agreement, or the item as written. `to` is the step that holds the item, found by code. The old item and its children leave.
 */
export type PlanReplace =
    | { replace: string; to: string; kind: 'consequence'; with: ConsequenceEntry }
    | { replace: string; to: string; kind: 'rule'; with: RuleEntry }

/** A change once checked. */
export type PlanChange = PlanAddition | PlanMark | PlanReplace

export type AddKind = PlanAddition['add']
export type MarkKind = PlanMark['mark']

/** The additions a block takes by default: the sub-item kinds (`consequences`'), with no expansion and no mark. */
export const SUB_ITEM_ADDS: readonly AddKind[] = ['consequence', 'concern', 'possibility']

/** The kinds a `replace` takes: the ones that can be unchecked today (mine; another kind's form waits on a writer of it). */
const REPLACEABLE: readonly AuthoredKind[] = ['consequence', 'rule']

/** What a merge holds to a step's own items, as against an expansion, a mark or a replacement. */
type ItemAddition = Exclude<PlanAddition, { add: 'steps' }>

const isMark = (change: PlanChange): change is PlanMark => 'mark' in change
const isReplace = (change: PlanChange): change is PlanReplace => 'replace' in change
const isExpansion = (change: PlanChange): change is Extract<PlanAddition, { add: 'steps' }> => !isMark(change) && !isReplace(change) && change.add === 'steps'
const isItemAddition = (change: PlanChange): change is ItemAddition => !isMark(change) && !isReplace(change) && change.add !== 'steps'
const isPossibility = (change: PlanChange): change is Extract<PlanAddition, { add: 'possibility' }> => isItemAddition(change) && change.add === 'possibility'

/** What a change block is merged against: the plan, the scene's handles, which the plan doesn't hold (mine), and who wrote it. */
export type PlanChangesInput = { plan: ActionPlan; handles: readonly SceneHandle[]; author: PlanAuthor }

const CHANGE_KEYS = ['add', 'to', 'thing', 'says']
const CONSEQUENCE_KEYS = ['add', 'to', 'thing', 'says', 'rules']
const POSSIBILITY_KEYS = ['add', 'to', 'kind', 'says', 'branches']
const STEPS_KEYS = ['add', 'to', 'steps']
const MARK_KEYS = ['mark', 'to']
const REPLACE_KEYS = ['replace', 'with']
const BRANCH_KEYS = ['add', 'thing', 'says']
const SUB_STEP_KEYS = ['says', 'intent', 'consequences']
const CONSEQUENCE_ENTRY_KEYS = ['says', 'thing', 'rules']
const RULE_KEYS = ['rule', 'stance']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * What a merge takes, and how it words a refusal:
 * - `author`: the piece that wrote the block, which sets each item's standing by `AUTHORITY` (IS-1);
 * - `handlesAre`: what a `thing` outside the handles is, `in the scene` when the handles are the scene's (the default), or as the caller
 *   names its handles, such as `a listed thing or named by the step` for `consequences`;
 * - `adds`: the additions it takes, by default the sub-item kinds (`SUB_ITEM_ADDS`); `playByPlay` takes `steps` and `consequence`;
 * - `marks`: the marks it takes, by default none; `playByPlay` takes `atomic`;
 * - `rules`: the rule handles a consequence may name, the ones the scene shows, by default none;
 * - `replaces`: whether it takes a `replace`, by default not (no piece checks yet).
 */
export type MergeOptions = {
    author: PlanAuthor
    handlesAre?: string
    adds?: readonly AddKind[]
    marks?: readonly MarkKind[]
    rules?: readonly string[]
    replaces?: boolean
}

/** An item a `replace` may name: its kind, standing and the step whose scope holds it. */
type IndexedItem = { kind: AuthoredKind; standing: Standing; step: string }

type CheckContext = {
    stepPaths: ReadonlySet<string>
    itemPaths: ReadonlySet<string>
    items: ReadonlyMap<string, IndexedItem>
    handles: readonly SceneHandle[]
    handlesAre: string
    adds: readonly AddKind[]
    marks: readonly MarkKind[]
    rules: readonly string[]
    replaces: boolean
    author: PlanAuthor
}

const handleOf = (thing: unknown): string | undefined => (typeof thing === 'string' ? thing.trim().replace(/^\[(.*)\]$/, '$1').trim() : undefined)

const thingProblems = (thing: unknown, { handles, handlesAre }: CheckContext): string[] => {
    const handle = handleOf(thing)
    return thing === undefined ? [] : handle === undefined ? ['"thing" is not a string'] : handles.includes(handle) ? [] : [`thing "${handle}" is not ${handlesAre}`]
}

const saysProblems = (says: unknown): string[] => (typeof says === 'string' && says.trim() !== '' ? [] : ['has no non-empty string "says"'])

/** A key outside `keys`: named as such, or, for a field code sets, said to be code's. */
const keyProblem = (key: string, keys: readonly string[]): string => (
    key === 'standing' ? '"standing" isn\'t writable: code sets it from who wrote the item'
        : key === 'intended' ? '"intended" isn\'t writable: a change adds only unintended consequences'
        : `has "${key}", not one of ${keys.join(', ')}`
)

const extraKeyProblems = (entry: Record<string, unknown>, keys: readonly string[]): string[] =>
    Object.keys(entry).filter((key) => !keys.includes(key)).map((key) => keyProblem(key, keys))

/** A `to`'s problems: none when it names a step at any depth. */
const targetProblems = (target: string | undefined, { stepPaths, itemPaths }: CheckContext): string[] =>
    target === undefined ? ['has no string "to"']
        : stepPaths.has(target) ? [] : itemPaths.has(target) ? [`to "${target}" names a sub-item, not a step`] : [`to "${target}" names no step`]

/** One rule entry checked: an object of `rule` (a handle the scene shows) and `stance`. */
const checkRule = (entry: unknown, { rules }: CheckContext): { rule: RuleEntry } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    const handle = handleOf(entry.rule)
    const problems = [
        ...extraKeyProblems(entry, RULE_KEYS),
        ...(handle === undefined || handle === '' ? ['has no string "rule"'] : rules.includes(handle) ? [] : [`rule "${handle}" is not a rule the scene holds`]),
        ...((RULE_STANCES as readonly unknown[]).includes(entry.stance) ? [] : [`"stance" must be one of ${RULE_STANCES.join(', ')}`]),
    ]
    return problems.length > 0 || handle === undefined ? { problems } : { rule: { rule: handle, stance: entry.stance as RuleStance } }
}

/** A consequence's `rules`: absent, or a list of rule entries. */
const checkRules = (rules: unknown, context: CheckContext): { rules?: RuleEntry[] } | { problems: string[] } => {
    if (rules === undefined) {
        return {}
    }
    if (!Array.isArray(rules)) {
        return { problems: ['"rules" is not a list'] }
    }
    const checked = rules.map((entry) => checkRule(entry, context))
    const problems = checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `rule ${index + 1}: ${problem}`) : []))
    return problems.length > 0 ? { problems } : { rules: checked.flatMap((result) => ('rule' in result ? [result.rule] : [])) }
}

/** A consequence's fields checked, wherever it is written: `says`, `thing` and `rules`. Keys are the caller's to check. */
const checkConsequenceFields = (entry: Record<string, unknown>, context: CheckContext): { consequence: ConsequenceEntry } | { problems: string[] } => {
    const rules = checkRules(entry.rules, context)
    const problems = [...thingProblems(entry.thing, context), ...saysProblems(entry.says), ...('problems' in rules ? rules.problems : [])]
    if (problems.length > 0 || typeof entry.says !== 'string' || 'problems' in rules) {
        return { problems }
    }
    const handle = handleOf(entry.thing)
    return { consequence: { says: entry.says, ...(handle === undefined ? {} : { thing: handle }), ...(rules.rules === undefined ? {} : { rules: rules.rules }) } }
}

/** A consequence written as an entry (a sub-step's, or a replacement): an object of `says`, `thing` and `rules`. */
const checkConsequenceEntry = (entry: unknown, context: CheckContext): { consequence: ConsequenceEntry } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    const fields = checkConsequenceFields(entry, context)
    const extra = extraKeyProblems(entry, CONSEQUENCE_ENTRY_KEYS)
    return extra.length > 0 ? { problems: [...extra, ...('problems' in fields ? fields.problems : [])] } : fields
}

/** One consequence in a branch: written as a flat one is, `add` optional; a concern has no place in a branch, nor does a rule. */
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

/** A sub-step's `consequences`: absent, or a list of consequence entries, what that motion brings about (IS-5). */
const checkSubStepConsequences = (consequences: unknown, context: CheckContext): { consequences?: ConsequenceEntry[] } | { problems: string[] } => {
    if (consequences === undefined) {
        return {}
    }
    if (!Array.isArray(consequences)) {
        return { problems: ['"consequences" is not a list'] }
    }
    const checked = consequences.map((entry) => checkConsequenceEntry(entry, context))
    const problems = checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `consequence ${index + 1}: ${problem}`) : []))
    return problems.length > 0 ? { problems } : { consequences: checked.flatMap((result) => ('consequence' in result ? [result.consequence] : [])) }
}

/**
 * An expansion's sub-steps: a list of at least two (the user), each an object with a non-empty `says`, where it helps a non-empty
 * `intent` (the user), and optionally the `consequences` that motion brings about. No sub-step `thing` is checked: a sub-step may
 * improvise an object (the user, 2026-11-18); a consequence's `thing` is checked as anywhere.
 */
const checkSubSteps = (steps: unknown, context: CheckContext): { steps: SubStepEntry[] } | { problems: string[] } => {
    if (!Array.isArray(steps)) {
        return { problems: ['has no "steps" list'] }
    }
    const checked = steps.map((entry) => (isRecord(entry) ? checkSubStepConsequences(entry.consequences, context) : undefined))
    const problems = [
        ...(steps.length >= 2 ? [] : [`has ${steps.length} sub-step${steps.length === 1 ? '' : 's'}; an expansion needs at least two`]),
        ...steps.flatMap((entry, index) => {
            const consequences = checked[index]
            return (isRecord(entry)
                ? [
                    ...extraKeyProblems(entry, SUB_STEP_KEYS),
                    ...saysProblems(entry.says),
                    ...(entry.intent === undefined || (typeof entry.intent === 'string' && entry.intent.trim() !== '') ? [] : ['"intent" is not a non-empty string']),
                    ...(consequences !== undefined && 'problems' in consequences ? consequences.problems : []),
                ]
                : ['is not an object']).map((problem) => `sub-step ${index + 1}: ${problem}`)
        }),
    ]
    return problems.length > 0
        ? { problems }
        : {
            steps: steps.flatMap((entry, index): SubStepEntry[] => {
                const consequences = checked[index]
                return isRecord(entry) ? [{
                    says: entry.says as string,
                    ...(typeof entry.intent === 'string' ? { intent: entry.intent } : {}),
                    ...(consequences !== undefined && 'consequences' in consequences && consequences.consequences !== undefined ? { consequences: consequences.consequences } : {}),
                }] : []
            }),
        }
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

/**
 * A replacement checked (IS-2): one the merge takes, naming an unchecked consequence or rule, from that kind's authority, with a `with`
 * of the same kind. A consequence's `with` is a consequence entry; a rule's is a rule entry.
 */
const checkReplace = (entry: Record<string, unknown>, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    const path = typeof entry.replace === 'string' ? entry.replace.trim() : undefined
    const found = path === undefined ? undefined : context.items.get(path)
    const named = path === undefined ? ['"replace" is not a string path']
        : found !== undefined ? []
        : context.stepPaths.has(path) ? [`replace "${path}" names a step; a step isn't replaced`]
        : [`replace "${path}" names no item`]
    const standing = found === undefined ? []
        : !REPLACEABLE.includes(found.kind) ? [`replace takes a consequence or a rule, not ${/^[aeiou]/.test(found.kind) ? 'an' : 'a'} ${found.kind}`]
        : [
            ...(found.standing === 'confirmed' ? [`"${path}" is confirmed; only an unchecked item is replaced`] : []),
            ...(AUTHORITY[found.kind] === context.author ? [] : [`only ${AUTHORITY[found.kind]} replaces a ${found.kind}; this block is ${context.author}'s`]),
        ]
    const replacement = entry.with
    const shapedAs = !isRecord(replacement) ? undefined : 'rule' in replacement || 'stance' in replacement ? 'rule' : 'consequence'
    const withChecked = found === undefined || !REPLACEABLE.includes(found.kind) ? undefined
        : !isRecord(replacement) ? { problems: ['"with" is not an object'] }
        : shapedAs !== found.kind ? { problems: [`"with" is a ${shapedAs}; "${path}" is a ${found.kind}`] }
        : found.kind === 'rule' ? checkRule(replacement, context) : checkConsequenceEntry(replacement, context)
    const problems = [
        ...(context.replaces ? [] : ['"replace" isn\'t a change this block takes']),
        ...extraKeyProblems(entry, REPLACE_KEYS),
        ...named,
        ...standing,
        ...(withChecked !== undefined && 'problems' in withChecked ? withChecked.problems.map((problem) => `with: ${problem}`) : []),
    ]
    if (problems.length > 0 || path === undefined || found === undefined || withChecked === undefined || 'problems' in withChecked) {
        return { problems }
    }
    return 'rule' in withChecked
        ? { change: { replace: path, to: found.step, kind: 'rule', with: withChecked.rule } }
        : { change: { replace: path, to: found.step, kind: 'consequence', with: withChecked.consequence } }
}

/** One change checked against the plan's paths, the handles and what the merge takes: the change, or every problem with it. */
const checkChange = (entry: unknown, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    if (!isRecord(entry)) {
        return { problems: ['is not an object'] }
    }
    if ('mark' in entry) {
        return checkMark(entry, context)
    }
    if ('replace' in entry) {
        return checkReplace(entry, context)
    }
    const { add, to, thing, says } = entry
    const keys = add === 'possibility' ? POSSIBILITY_KEYS : add === 'steps' ? STEPS_KEYS : add === 'consequence' ? CONSEQUENCE_KEYS : CHANGE_KEYS
    const target = typeof to === 'string' ? to.trim() : undefined
    const branches = add === 'possibility' ? checkBranches(entry.branches, context) : undefined
    const steps = add === 'steps' ? checkSubSteps(entry.steps, context) : undefined
    const consequence = add === 'consequence' ? checkConsequenceFields(entry, context) : undefined
    const problems = [
        ...Object.keys(entry).filter((key) => !keys.includes(key))
            .map((key) => (key === 'rules' && add === 'concern' ? 'a concern takes no "rules": a rule follows from a consequence' : keyProblem(key, keys))),
        ...(typeof add === 'string' && (context.adds as readonly string[]).includes(add) ? [] : [`"add" must be one of ${context.adds.join(', ')}`]),
        ...targetProblems(target, context),
        ...(consequence !== undefined ? ('problems' in consequence ? consequence.problems : []) : add === 'possibility' || add === 'steps' ? [] : thingProblems(thing, context)),
        ...(add === 'concern' && thing !== undefined ? ['a concern takes no "thing"'] : []),
        ...(add === 'possibility' && !(OPENNESS_KINDS as readonly unknown[]).includes(entry.kind) ? [`"kind" must be one of ${OPENNESS_KINDS.join(', ')}`] : []),
        ...(add === 'steps' || add === 'consequence' ? [] : saysProblems(says)),
        ...(branches !== undefined && 'problems' in branches ? branches.problems : []),
        ...(steps !== undefined && 'problems' in steps ? steps.problems : []),
    ]
    if (problems.length > 0 || target === undefined) {
        return { problems }
    }
    if (add === 'steps') {
        return { change: { add, to: target, steps: steps !== undefined && 'steps' in steps ? steps.steps : [] } }
    }
    if (consequence !== undefined && 'consequence' in consequence) {
        return { change: { add: 'consequence', to: target, ...consequence.consequence } }
    }
    if (typeof says !== 'string') {
        return { problems }
    }
    if (add === 'possibility') {
        return { change: { add, to: target, openness: entry.kind as Openness, says, branches: branches !== undefined && 'branches' in branches ? branches.branches : [] } }
    }
    return { change: { add: 'concern', to: target, says } }
}

/** What a consequence's paths are minted from: its text, then each rule's handle, in order. */
const consequenceSources = ({ says, rules = [] }: ConsequenceEntry): PathSource[] => [pathSource('consequence', says), ...rules.map(({ rule }) => ruleSource(rule))]

/** What each change's paths are minted from, depth first: a possibility, then each branch and its consequences in order. */
const changeSources = (change: ItemAddition | PlanReplace): PathSource[] => (
    isReplace(change) ? (change.kind === 'rule' ? [ruleSource(change.with.rule)] : consequenceSources(change.with))
        : change.add === 'possibility'
            ? [pathSource(change.openness, change.says), ...change.branches.flatMap((branch) => [pathSource('maybe', ''), ...branch.map(({ says }) => pathSource('consequence', says))])]
            : change.add === 'consequence' ? consequenceSources(change) : [pathSource(change.add, change.says)]
)

/** A consequence as an item, its path then its rules' taken in order from `paths`; its own standing given, its rules' by their authority. */
const consequenceItem = ({ says, thing, rules = [] }: ConsequenceEntry, standing: Standing, author: PlanAuthor, paths: readonly string[]): ConsequenceItem => ({
    kind: 'consequence',
    path: paths[0],
    standing,
    says,
    ...(thing === undefined ? {} : { thing }),
    ...(rules.length === 0 ? {} : { rules: rules.map(({ rule, stance }, index): RuleItem => ({ kind: 'rule', path: paths[index + 1], standing: standingOf('rule', author), rule, stance })) }),
})

/** A checked change as an item, its paths taken in order from `paths`, minted by `changeSources`' order; its standing by `author`. */
const changeItem = (change: ItemAddition, stepPath: string, paths: readonly string[], author: PlanAuthor): StepItem => {
    const at = (index: number) => `${stepPath}.${paths[index]}`
    const standing = standingOf(change.add, author)
    if (change.add === 'concern') {
        return { kind: 'concern', path: at(0), standing, says: change.says }
    }
    if (change.add === 'consequence') {
        return consequenceItem(change, standing, author, paths.map((_, index) => at(index)))
    }
    const branches = change.branches.reduce<{ branches: Branch[]; next: number }>(({ branches: built, next }, branch) => ({
        branches: [...built, {
            kind: 'maybe',
            path: at(next),
            items: branch.map(({ thing, says }, index): BranchConsequence => ({ kind: 'consequence', path: at(next + 1 + index), says, ...(thing === undefined ? {} : { thing }) })),
        }],
        next: next + 1 + branch.length,
    }), { branches: [], next: 1 }).branches
    return { kind: 'possibility', path: at(0), standing, openness: change.openness, says: change.says, branches }
}

/**
 * A sub-step as an item: its path a step path, then in its own scope its intent (when given), and the consequences that motion brings
 * about with their rules. Each standing by `author`: from `playByPlay`, the sub-step and its intent confirmed, the rest unchecked (IS-8).
 */
const subStepItem = ({ says, intent, consequences = [] }: SubStepEntry, path: string, author: PlanAuthor): SubStep => {
    const sources = consequences.map(consequenceSources)
    const minted = mintPaths(sources.flat(), intent === undefined ? [] : ['intent'])
    const built = consequences.reduce<{ items: ConsequenceItem[]; next: number }>(({ items, next }, entry, index) => ({
        items: [...items, consequenceItem(entry, standingOf('consequence', author), author, minted.slice(next, next + sources[index].length).map((slugged) => `${path}.${slugged}`))],
        next: next + sources[index].length,
    }), { items: [], next: 0 }).items
    return {
        kind: 'step',
        path,
        standing: standingOf('step', author),
        says,
        suppliedBy: 'system',
        items: [...(intent === undefined ? [] : [{ kind: 'intent' as const, path: `${path}.intent`, standing: standingOf('intent', author), says: intent }]), ...built],
    }
}

type Accepted = { index: number; change: PlanChange }

/** At most one `execution` possibility per step, counting the plan's and the block's. */
const possibilityLimitProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        if (!isPossibility(change)) {
            return []
        }
        const held = steps.get(change.to)?.items.some((item) => item.kind === 'possibility' && item.openness === change.openness) ?? false
        const earlier = accepted.some((other) => other.index < index && isPossibility(other.change) && other.change.to === change.to && other.change.openness === change.openness)
        return held || earlier ? [`change ${index + 1}: step ${change.to} already has an ${change.openness} possibility; a step holds at most one`] : []
    })

/** An item is replaced at most once in a block. */
const replaceProblems = (accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => (isReplace(change) && accepted.some((other) => other.index < index && isReplace(other.change) && other.change.replace === change.replace)
        ? [`change ${index + 1}: "${change.replace}" is already replaced in this block`]
        : []))

/**
 * A step is expanded at most once, more detail going into its sub-steps; a step marked atomic takes no expansion; the tag is set once;
 * and a step is expanded or atomic, never both (the user, 2026-11-18). Counting the plan's and the block's earlier changes.
 */
const expansionProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        const step = steps.get(change.to)
        if (step === undefined || !(isMark(change) || isExpansion(change))) {
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

/** A step's items with each replaced path's item gone, its children with it; a replaced rule leaves its consequence. The scope a replacement is minted against. */
const withoutReplaced = (items: readonly StepItem[], replaced: ReadonlySet<string>): StepItem[] => items
    .filter(({ path }) => !replaced.has(path))
    .map((item) => (item.kind === 'consequence' && item.rules !== undefined && item.rules.some(({ path }) => replaced.has(path))
        ? { ...item, rules: item.rules.filter(({ path }) => !replaced.has(path)) }
        : item))

/**
 * A step with its replacements put in: a consequence in the old one's place among the items, a rule in the old one's place among its
 * consequence's rules. The replacement is confirmed: only the kind's authority replaces.
 */
const withReplacements = (items: readonly StepItem[], replacements: readonly { change: PlanReplace; paths: readonly string[] }[], author: PlanAuthor): StepItem[] =>
    items.map((item) => {
        const own = replacements.find(({ change }) => change.kind === 'consequence' && change.replace === item.path)
        if (own !== undefined && own.change.kind === 'consequence') {
            return consequenceItem(own.change.with, 'confirmed', author, own.paths)
        }
        if (item.kind !== 'consequence' || item.rules === undefined) {
            return item
        }
        const rules = item.rules.map((rule) => {
            const found = replacements.find(({ change }) => change.kind === 'rule' && change.replace === rule.path)
            return found === undefined || found.change.kind !== 'rule' ? rule : { kind: 'rule' as const, path: found.paths[0], standing: 'confirmed' as const, ...found.change.with }
        })
        return rules.every((rule, index) => rule === item.rules?.[index]) ? item : { ...item, rules }
    })

/**
 * A step with the block's changes to it applied: replaced items removed first, so a confirmation as written mints its old path again;
 * additions and replacements minted in its own scope, in block order; sub-steps from `subStepPaths`; the mark set.
 */
const applyChanges = (step: StepNode, changes: readonly Accepted[], subStepPaths: ReadonlyMap<number, readonly string[]>, author: PlanAuthor): Pick<StepNode, 'items' | 'atomic'> => {
    const replaces = changes.map(({ change }) => change).filter(isReplace)
    const kept = withoutReplaced(step.items, new Set(replaces.map(({ replace }) => replace)))
    const minted = changes.map(({ change }) => change).filter((change): change is ItemAddition | PlanReplace => isItemAddition(change) || isReplace(change))
    const sources = minted.map(changeSources)
    const paths = mintPaths(sources.flat(), scopePaths(kept).map((path) => path.slice(step.path.length + 1)))
    const placed = minted.reduce<{ items: StepItem[]; replacements: { change: PlanReplace; paths: string[] }[]; next: number }>(({ items, replacements, next }, change, index) => {
        const own = paths.slice(next, next + sources[index].length)
        return isReplace(change)
            ? { items, replacements: [...replacements, { change, paths: own.map((path) => `${step.path}.${path}`) }], next: next + own.length }
            : { items: [...items, changeItem(change, step.path, own, author)], replacements, next: next + own.length }
    }, { items: [], replacements: [], next: 0 })
    const items = withReplacements(step.items, placed.replacements, author)
    const subSteps = changes.flatMap(({ index, change }) => (isExpansion(change) ? change.steps.map((entry, at) => subStepItem(entry, subStepPaths.get(index)?.[at] ?? '', author)) : []))
    return { items: orderItems([...items, ...placed.items, ...subSteps]), ...(changes.some(({ change }) => isMark(change)) ? { atomic: true as const } : {}) }
}

/** Every item a `replace` may name, by path: each step's items in its own scope, and each consequence's rules. */
const indexItems = (steps: readonly StepNode[]): Map<string, IndexedItem> => new Map(steps.flatMap(({ path: step, items }) => items.flatMap((item): [string, IndexedItem][] => (
    item.kind === 'step' ? []
        : [
            [item.path, { kind: item.kind, standing: item.standing, step }],
            ...(item.kind === 'consequence' ? (item.rules ?? []).map(({ path, standing }): [string, IndexedItem] => [path, { kind: 'rule', standing, step }]) : []),
        ]
))))

/**
 * A change block merged into a plan: each addition minted under its step, against the step's paths already taken, and placed
 * by the order rule; each sub-step minted in the plan's one scope of step paths; each replacement in its old item's place; every other
 * item and path unchanged. Each new item's standing is set by `author` (`standingOf`). A change may address a step at any depth. The
 * whole block is refused on any problem, with every problem listed. A key beside `changes` is a problem, since what it holds would
 * otherwise be dropped unseen (`consequences`' batch 4, a `"concerns"` key).
 */
export const mergeChanges = (
    plan: ActionPlan, block: unknown, handles: readonly SceneHandle[],
    { author, handlesAre = 'in the scene', adds = SUB_ITEM_ADDS, marks = [], rules = [], replaces = false }: MergeOptions,
): { plan: ActionPlan } | { problems: string[] } => {
    const changes = isRecord(block) ? block.changes : undefined
    const besides = isRecord(block) ? Object.keys(block).filter((key) => key !== 'changes').map((key) => `the JSON block has "${key}"; everything it adds goes in "changes"`) : []
    if (!Array.isArray(changes)) {
        return { problems: [isRecord(block) ? 'the JSON block has no "changes" array' : 'the change block is not an object', ...besides] }
    }
    const steps = new Map(planSteps(plan).map((step) => [step.path, step]))
    const itemPathSet = new Set([...steps.values()].flatMap(({ items }) => scopePaths(items)))
    const context: CheckContext = {
        stepPaths: new Set(steps.keys()), itemPaths: itemPathSet, items: indexItems([...steps.values()]), handles, handlesAre, adds, marks, rules, replaces, author,
    }
    const checked = changes.map((entry) => checkChange(entry, context))
    const accepted = checked.flatMap((result, index): Accepted[] => ('change' in result ? [{ index, change: result.change }] : []))
    const problems = [
        ...besides,
        ...checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `change ${index + 1}: ${problem}`) : [])),
        ...possibilityLimitProblems(steps, accepted),
        ...expansionProblems(steps, accepted),
        ...replaceProblems(accepted),
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
            steps: built.steps.map((step) => mapStep(step, target, (found) => applyChanges(found, accepted.filter(({ change }) => change.to === target), subStepPaths, author))),
        }), plan),
    }
}

/**
 * A change block scoped to one step, the one a generator expands: code supplies each change's
 * `to`, by the rule that an id a model writes is a reference waiting to break. A `to` the block does write must name the target;
 * otherwise the block is refused, as any problem refuses it. A `replace` takes no `to`, and must name an item in the target's own scope.
 * Then `mergeChanges`. The scope reads only `to`, so a new `add` kind, or a mark, passes through it to `checkChange`. The target may be a
 * step at any depth.
 */
export const mergeStepChanges = (plan: ActionPlan, target: string, block: unknown, handles: readonly SceneHandle[], options: MergeOptions): { plan: ActionPlan } | { problems: string[] } => {
    const step = planSteps(plan).find(({ path }) => path === target)
    if (step === undefined) {
        throw new Error(`The target "${target}" names no step of the plan`)
    }
    const changes = isRecord(block) ? block.changes : undefined
    if (!Array.isArray(changes)) {
        return mergeChanges(plan, block, handles, options)
    }
    const scope = new Set(scopePaths(step.items))
    const problems = changes.flatMap((entry, index) => {
        if (isRecord(entry) && 'replace' in entry) {
            return typeof entry.replace !== 'string' || scope.has(entry.replace.trim()) || !planSteps(plan).some(({ items }) => scopePaths(items).includes((entry.replace as string).trim()))
                ? []
                : [`change ${index + 1}: replace "${entry.replace}" is not in the step being expanded, ${target}`]
        }
        const to = isRecord(entry) ? entry.to : undefined
        return to === undefined || (typeof to === 'string' && to.trim() === target)
            ? []
            : [`change ${index + 1}: to ${JSON.stringify(to)} is not the step being expanded, ${target}`]
    })
    if (problems.length > 0) {
        return { problems }
    }
    return mergeChanges(plan, { ...(block as Record<string, unknown>), changes: changes.map((entry) => (isRecord(entry) && !('replace' in entry) ? { ...entry, to: target } : entry)) }, handles, options)
}

/**
 * An entry with its `says` and `intent` bracketed, and within it a possibility's branches' entries, an expansion's sub-steps, a sub-step's
 * consequences and a replacement's `with`, with theirs.
 */
const bracketEntry = (entry: unknown, handles: readonly SceneHandle[]): unknown => {
    if (!isRecord(entry)) {
        return entry
    }
    const texts = Object.fromEntries((['says', 'intent'] as const).flatMap((key) => {
        const text = entry[key]
        return typeof text === 'string' ? [[key, bracketHandles(text, handles)]] : []
    }))
    const inner = (list: unknown): unknown => (Array.isArray(list) ? list.map((item) => bracketEntry(item, handles)) : list)
    const lists = Object.fromEntries((['steps', 'consequences'] as const).flatMap((key) => (Array.isArray(entry[key]) ? [[key, inner(entry[key])]] : [])))
    const branches = Array.isArray(entry.branches) ? { branches: entry.branches.map(inner) } : {}
    const replacement = isRecord(entry.with) ? { with: bracketEntry(entry.with, handles) } : {}
    return { ...entry, ...texts, ...branches, ...lists, ...replacement }
}

/**
 * A block with each change's texts repaired: bare handles bracketed (`bracketHandles`, CQ-P5), against every handle the prompt names.
 * Anything else is left for the merge to check.
 */
export const bracketChanges = (block: Record<string, unknown>, handles: readonly SceneHandle[]): Record<string, unknown> => {
    const { changes } = block
    return Array.isArray(changes) ? { ...block, changes: changes.map((entry) => bracketEntry(entry, handles)) } : block
}

/** A reply in the change language: its trailing JSON block, merged into the plan shown (`mergeChanges`) as its author's. */
export const planChangesContract: StageContract<PlanChangesInput, ActionPlan> = {
    name: 'plan changes',
    parse: (reply, { input: { plan, handles, author } }) => {
        const parsed = replyJsonObject(reply)
        if ('malformed' in parsed) {
            return { problems: [parsed.malformed] }
        }
        const merged = mergeChanges(plan, parsed.object, handles, { author })
        return 'problems' in merged ? merged : { value: merged.plan }
    },
}
