//
// The action plan, a Prototype (calibration AGENT.md, "The action plan"): a candidate step with a path and its sub-items, built from each
// step shape in use, and a render for a generator to read. The judging pieces don't read it yet; they render from their own inputs.
// Paths are readable slugs minted at creation; changes add, restate a step, or replace or remove an unchecked item, so an item's path never
// changes while it is in the plan, and is the item's id; a step revised by its restatement takes a path minted afresh, as a replacement does,
// and its children move under it, called into question (the revision rule, calibration AGENT.md, "The action plan").
// A change language adds to it: a block of additions, merged in by code, the whole block refused on any problem.
// A possibility holds a spread of outcomes, as unlabelled branches of consequences. Every path is flat under its step, in one scope at
// any depth; consequences and concerns slug their text, every other kind its kind (`tip-table1.intent`, `.maybe-2`).
// A step expands in place into sub-steps, each a `step` item holding its own items: the one exception to the path rule, since a
// sub-step's path is a step path, minted in the plan's one scope of step paths at any depth (calibration AGENT.md, "The action plan").
// Every step and item has a standing, `confirmed` or `unchecked`, which code sets from who wrote it and the authority map, never from a
// reply; a kind's authority may replace an unchecked item with a confirmed one (calibration AGENT.md, The action plan). A `rule` item, a
// consequence's stance on one of the scene's rules, nests in the consequence it follows from.
// An unchecked item never refuses a change, and only its authority alters a confirmed one: a slot holding one value (a step's words, its
// intent, its sub-steps, its `execution` possibility) is overwritten while it is unchecked, and claims (consequences, rules) accumulate.
// Beside the steps, a plan holds the things improvised for what its steps need and the scene lacks, each under a handle of its own.
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
 * step and item has one (the user), set by code from the author and `AUTHORITY`, never by a reply.
 */
export type Standing = 'unchecked' | 'confirmed'

/**
 * The pieces that write to a plan. `triage`, the first screen on a command, is no kind's authority, so all it writes is unchecked.
 * `improvisation` isn't built (the user, 2026-11-20): it is the authority for what the others improvise.
 */
export type PlanAuthor = 'playByPlay' | 'consequences' | 'ruleCell' | 'triage' | 'improvisation'

/** A consequence's stance on a rule: it goes against a rule that stays in force (`violation`); the rule causes it, a result that ordinarily wouldn't happen, as the glue keeping a teapot on a tilted table (`causes`; was `effect`, and `consistent` before that); or it ends the rule, as prying a glued teapot loose ends the glue (`voids`; the after-state, a voided rule gone for later steps, is the parent's "State carried forward"). The user, 2026-11-20. */
export const RULE_STANCES = ['violation', 'causes', 'voids'] as const
export type RuleStance = typeof RULE_STANCES[number]

/**
 * A rule item: a consequence's stance on one of the scene's rules, named by its handle (`judgeRules`). It nests in the consequence
 * it follows from, since a rule is kept or broken by what moves, so it can't stand alone. Its path is flat in the step's scope, and is
 * the handle itself.
 */
export type RuleItem = { kind: 'rule'; path: string; standing: Standing; rule: string; stance: RuleStance; stale?: true }

/**
 * `stale` (the revision rule, calibration AGENT.md, "The action plan"): written against wording of its step since changed. Apart from standing: set on a revised
 * step's children (each also made unchecked), cleared only by the child's authority: a `replace` (a new item), a `remove`, or its giving
 * the child again, which confirms it. Code's, never
 * rendered to a model.
 */
export type Stale = { stale?: true }

/** A consequence within a branch: it happens only in that branch (the user, 2026-11-18). Never intended, as no change writes one. Its possibility's standing covers it. */
export type BranchConsequence = { kind: 'consequence'; path: string; says: string; thing?: SceneHandle }

/** One outcome of a possibility, unlabelled: an adjudicator reads from its consequences which branch is the intended one. */
export type Branch = { kind: 'maybe'; path: string; items: readonly BranchConsequence[] }

/** A consequence: what happens, with the rules it bears on nested under it. */
export type ConsequenceItem = { kind: 'consequence'; path: string; standing: Standing; says: string; thing?: SceneHandle; intended?: true; rules?: readonly RuleItem[] } & Stale

export type StepItem =
    | { kind: 'intent'; path: string; standing: Standing; says: string }
    | ConsequenceItem
    /** A spread of outcomes: what is open (`says`, the condition), and the branches it may fall into. A flat consequence beside it happens in every branch. */
    | ({ kind: 'possibility'; path: string; standing: Standing; openness: Openness; says: string; branches: readonly Branch[] } & Stale)
    /** The imagination's "possible problem": a deferral the oracle classifies, not a judge's claim. */
    | ({ kind: 'concern'; path: string; standing: Standing; says: string } & Stale)
    | SubStep

/**
 * A sub-step: a full planned step inside its parent, in order, from an expansion. Its path is a step path (flat, in the plan's step scope),
 * and its items are in its own scope. `alreadyAnswers`: as on any step. `stale`: it was unchecked when its parent was revised, and the block
 * gave the parent no sub-steps.
 */
export type SubStep = { kind: 'step'; path: string; standing: Standing; says: string; suppliedBy: 'system'; alreadyAnswers?: readonly string[]; items: readonly StepItem[] } & Stale

export type StepItemKind = StepItem['kind']

/**
 * A thing improvised (the user, 2026-11-25): where a step needs what should be a handle and the scene has no such object, a handle is
 * proposed for one, and the steps name it. The gloss says the object, or type of object, the action implies: the need, where what meets it is
 * the authority's to say. It stands beside the plan's steps, since several may name it, and its handle is its id, the one a model writes,
 * because its own text has to name it.
 */
export type ImproviseItem = { handle: SceneHandle; gloss: string; standing: Standing }

/** Every kind a piece writes: the step items', the rule's and the improvised thing's. */
export type AuthoredKind = StepItemKind | 'rule' | 'improvise'

/**
 * Who is authoritative for each kind (a fixed map for this iteration): the method's (a sub-step, and its intent) is `playByPlay`'s;
 * what happens is `consequences`'; a rule's stance is the rule cell's; an improvised thing is `improvisation`'s. A plan's own steps are its
 * source's, so builders confirm them.
 */
export const AUTHORITY: Record<AuthoredKind, PlanAuthor> = {
    step: 'playByPlay', intent: 'playByPlay', consequence: 'consequences', possibility: 'consequences', concern: 'consequences', rule: 'ruleCell',
    improvise: 'improvisation',
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

/**
 * A step's `alreadyAnswers` (calibration AGENT.md, The action plan): the details asked of it that what it holds answers, each
 * added by code from a restatement's request, never by a model. The judge's evidence that a question was asked, not a lock on asking it.
 */
export type PlannedStep = CandidateStep & { path: string; standing: Standing; alreadyAnswers?: readonly string[]; items: readonly StepItem[] }

/** What a planned step and a sub-step share: enough to find, expand, restate or render either. */
export type StepNode = { path: string; says: string; standing: Standing; alreadyAnswers?: readonly string[]; items: readonly StepItem[] } & Stale

/** A step and its sub-steps at every depth, depth first. */
const withSubSteps = (step: StepNode): StepNode[] => [step, ...step.items.flatMap((item) => (item.kind === 'step' ? withSubSteps(item) : []))]

/** Every step in the plan at any depth, depth first: the plan's one scope of step paths. */
export const planSteps = ({ steps }: ActionPlan): StepNode[] => steps.flatMap(withSubSteps)

/** A step's own scope: the paths of its items other than sub-steps, a possibility's included. A sub-step's are in its own scope. */
const scopePaths = (items: readonly StepItem[]): string[] => items.filter(({ kind }) => kind !== 'step').flatMap(itemPaths)

/** Whether a step is expanded: it holds sub-steps. */
export const isExpanded = ({ items }: Pick<StepNode, 'items'>): boolean => items.some(({ kind }) => kind === 'step')

/** Whether anything among the items is confirmed, at any depth, rules included. A possibility's standing covers its branches. */
const anyConfirmed = (items: readonly StepItem[]): boolean => items.some((item) => (
    item.standing === 'confirmed'
    || (item.kind === 'step' && anyConfirmed(item.items))
    || (item.kind === 'consequence' && (item.rules ?? []).some(({ standing }) => standing === 'confirmed'))
))

/** Whether a step is guarded as confirmed: it is, or it holds something that is. */
const isGuarded = ({ standing, items }: Pick<StepNode, 'standing' | 'items'>): boolean => standing === 'confirmed' || anyConfirmed(items)

/**
 * Why a step's sub-steps can't be given, by any author, or `undefined` when they can: one of those it holds is guarded as confirmed. Unchecked
 * ones are a proposal, which an expansion overwrites. For a piece's render too: where the reason may be something its view hides, the piece
 * isn't called, since no redraft could answer the refusal.
 */
export const expansionClosed = ({ path, items }: StepNode): string | undefined =>
    items.some((item) => item.kind === 'step' && isGuarded(item)) ? `step ${path} is already expanded; expand one of its sub-steps for more detail` : undefined

/**
 * Why an author's restatement can't change a step's words, or `undefined` when it can: anyone but the step's authority, where it is guarded as
 * confirmed; and its authority, where its sub-steps are, as they are the method of the words they were written for. For a render too, as
 * {@link expansionClosed}.
 */
export const rewordingClosed = (step: StepNode, author: PlanAuthor): string | undefined => (
    expansionClosed(step) !== undefined ? `step ${step.path} is expanded, so it isn't revised; revise one of its sub-steps`
        : AUTHORITY.step === author || !isGuarded(step) ? undefined
        : `step ${step.path} ${step.standing === 'confirmed' ? 'is' : 'holds something'} confirmed; only ${AUTHORITY.step} changes its words`
)

/** What a change block gives one step: its items, and from a restatement its text, path, standing and answers. */
type StepUpdate = Partial<Pick<StepNode, 'path' | 'says' | 'standing' | 'alreadyAnswers' | 'stale'>> & Pick<StepNode, 'items'>

/** A step given an update; a `stale` given as undefined takes the mark off. */
const updated = <Step extends StepNode>(step: Step, update: StepUpdate): Step => {
    const next = { ...step, ...update }
    if ('stale' in next && next.stale === undefined) {
        delete next.stale
    }
    return next
}

/** A step, with the one step at `path` (itself or a sub-step at any depth) given what `change` returns; every other part kept as it is. */
const mapStep = <Step extends StepNode>(step: Step, path: string, change: (step: StepNode) => StepUpdate): Step => {
    if (step.path === path) {
        return updated(step, change(step))
    }
    const items = step.items.map((item) => (item.kind === 'step' ? mapStep(item, path, change) : item))
    return items.every((item, index) => item === step.items[index]) ? step : { ...step, items }
}

/** A plan: its steps, and the things improvised for them, absent where there are none. */
export type ActionPlan = { steps: readonly PlannedStep[]; improvised?: readonly ImproviseItem[] }

/** A plan holding these improvised things, with no key where there are none. */
const withImprovised = (steps: readonly PlannedStep[], improvised: readonly ImproviseItem[]): ActionPlan => ({ steps, ...(improvised.length === 0 ? {} : { improvised }) })

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

/**
 * An item a builder gives, before its path is minted. Possibilities come only from changes, so no builder takes one (mine). An intent
 * may be given `unchecked` (the user, 2026-11-20): one divined from a player's command is an offer until its authority restates it; one
 * established further on is confirmed, the default.
 */
export type UnmintedItem =
    | { kind: 'intent'; says: string; standing?: Standing }
    | { kind: 'consequence'; says: string; thing?: SceneHandle; intended?: true }
    | { kind: 'concern'; says: string }

/** What a path is minted from: a consequence's or a concern's text, or else the kind itself (`intent`, `execution`, `maybe`). */
const pathSource = (kind: 'intent' | 'consequence' | 'concern' | 'maybe' | Openness, says: string): PathSource =>
    kind === 'consequence' || kind === 'concern' ? { says, fallback: kind } : { says: kind, fallback: kind }

/** A rule's path is its handle, unslugged (a slug would drop its "to"). */
const ruleSource = (rule: string): PathSource => ({ says: rule, fallback: 'rule', literal: true })

/** A step's items ordered, then each path minted under the step's, in one scope across kinds. A builder's items are its source's, so confirmed, unless an intent is given its standing. */
const mintItems = (stepPath: string, items: readonly UnmintedItem[]): StepItem[] => {
    const ordered = orderItems(items)
    const paths = mintPaths(ordered.map(({ kind, says }) => pathSource(kind, says)))
    return ordered.map((item, index) => ({ ...item, path: `${stepPath}.${paths[index]}`, standing: ('standing' in item ? item.standing : undefined) ?? 'confirmed' }) as StepItem)
}

/**
 * Steps with their items: each step's path minted, then each item's under it, ordered by kind (for a builder outside this file). A plan's
 * own steps and items are its source's, the authority for them, so every one is confirmed, unless a step (or an intent) is given its
 * standing: a player's raw command is an offer, as an intent divined from it is.
 */
export const planOf = (steps: readonly { step: CandidateStep; items: readonly UnmintedItem[]; standing?: Standing }[]): ActionPlan => {
    const paths = mintPaths(steps.map(({ step: { says } }) => ({ says, fallback: 'step' })))
    return { steps: steps.map(({ step, items, standing = 'confirmed' }, index) => ({ ...step, path: paths[index], standing, items: mintItems(paths[index], items) })) }
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

/** ` (unchecked)` after an unchecked item's path (R1, the first render candidate tried); a confirmed item has no tag and reads as fact. */
const uncheckedTag = (standing: Standing): string => (standing === 'unchecked' ? ' (unchecked)' : '')

const STANCE_WORDS: Record<RuleStance, string> = { violation: 'Violation', causes: 'Causes', voids: 'Voids' }

/** A rule under its consequence: `Rule (Violation) <path>: [<handle>]` (the user's wording). */
const ruleLine = ({ path, standing, rule, stance }: RuleItem, indent: string): string =>
    `${indent}- Rule (${STANCE_WORDS[stance]}) ${path}${uncheckedTag(standing)}: [${rule}]`

/** A step's answered details, first under it: `- already answers: <detail>`, one per entry (mine, for tuning). */
const answerLines = (answers: readonly string[] | undefined, indent: string): string[] => (answers ?? []).map((detail) => `${indent}- already answers: ${detail}`)

/** An item's lines in the generator's render: one indent per level, so a possibility's branches, a sub-step's items and a consequence's rules sit under it. */
const itemLines = (item: StepItem, depth = 1): string[] => {
    const indent = '  '.repeat(depth)
    if (item.kind === 'step') {
        return [
            `${indent}- step ${item.path}${uncheckedTag(item.standing)}: ${item.says}`,
            ...answerLines(item.alreadyAnswers, `${indent}  `),
            ...item.items.flatMap((inner) => itemLines(inner, depth + 1)),
        ]
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

/**
 * A plan for a generator to read: a line per improvised thing, before the steps that name it (mine, for tuning: no prompt shows one yet);
 * then a line per step, its items indented under it, each with its kind and path, sub-steps nested.
 */
export const renderPlanForGenerator = ({ steps, improvised = [] }: ActionPlan): string => [
    ...improvised.map(({ handle, gloss, standing }) => `Improvise [${handle}]${uncheckedTag(standing)}: ${gloss}`),
    ...steps.flatMap(({ path, says, standing, alreadyAnswers, items }) => [
        `Step ${path}${uncheckedTag(standing)}: ${says}`,
        ...answerLines(alreadyAnswers, '  '),
        ...items.flatMap((item) => itemLines(item)),
    ]),
].join('\n')

/** How much of a kind a view reads: every entry, unchecked ones included (`all`), or only the confirmed (`authoritative`). */
export type PlanReading = 'all' | 'authoritative'

/**
 * A piece's view of the plan (calibration AGENT.md, "Piece views"): the kinds it reads, each at a reading; a kind not named isn't read.
 * The plan's top-level steps and every step's `alreadyAnswers` are always shown. No exemption for the piece's own items: its unchecked
 * proposals are filtered like anyone's.
 */
export type PlanView = { reads: Partial<Record<Exclude<AuthoredKind, 'rule'>, PlanReading>> & { rule?: PlanReading | RuleReading } }

/**
 * A rule reading narrowed by stance: only rule items with one of these stances are read, at the reading (the rule kind alone takes one).
 * `playByPlay` reads confirmed `causes` and `voids`, which explain a confirmed consequence, and not `violation`, a verdict on the method
 * (the user, 2026-11-21, calibration AGENT.md, "Piece views").
 */
export type RuleReading = { reading: PlanReading; stances: readonly RuleStance[] }

/** Every kind at `all`: the plan as it is. */
export const WHOLE_PLAN_VIEW: PlanView = { reads: { step: 'all', intent: 'all', consequence: 'all', possibility: 'all', concern: 'all', rule: 'all', improvise: 'all' } }

/** No kind read: a piece that renders from its own inputs, not the plan (the judges, in the bridge state). */
export const NO_PLAN_VIEW: PlanView = { reads: {} }

/** Whether a view reads an entry of a kind at a standing. */
const viewReads = ({ reads }: PlanView, kind: Exclude<AuthoredKind, 'rule'>, standing: Standing): boolean => readingTakes(reads[kind], standing)

/** Whether a reading takes an entry at a standing. */
const readingTakes = (reading: PlanReading | undefined, standing: Standing): boolean => reading === 'all' || (reading === 'authoritative' && standing === 'confirmed')

/** Whether a view reads a rule item: its standing at the rule reading, and its stance among the reading's, when it names some. */
const viewReadsRule = ({ reads: { rule: reading } }: PlanView, { standing, stance }: RuleItem): boolean => (
    typeof reading === 'object' ? reading.stances.includes(stance) && readingTakes(reading.reading, standing) : readingTakes(reading, standing)
)

/** A step's items as a view reads them, at every depth: a dropped sub-step takes its items with it, a dropped consequence its rules; a possibility's branches go with it. */
const viewedItems = (items: readonly StepItem[], view: PlanView): StepItem[] => items.flatMap((item): StepItem[] => {
    if (!viewReads(view, item.kind, item.standing)) {
        return []
    }
    if (item.kind === 'step') {
        return [{ ...item, items: viewedItems(item.items, view) }]
    }
    if (item.kind !== 'consequence' || item.rules === undefined) {
        return [item]
    }
    const rules = item.rules.filter((rule) => viewReadsRule(view, rule))
    if (rules.length === item.rules.length) {
        return [item]
    }
    const { rules: _dropped, ...rest } = item
    return [rules.length === 0 ? rest : { ...rest, rules }]
})

/**
 * The plan as a view reads it, for `renderPlanForGenerator` to render unchanged: pure, so a view reading every kind at `all`
 * gives the plan back as it is, and its render and inputs hash with it. The merge still reads the full plan.
 */
export const viewPlan = ({ steps, improvised = [] }: ActionPlan, view: PlanView): ActionPlan => withImprovised(
    steps.map((step) => ({ ...step, items: viewedItems(step.items, view) })),
    improvised.filter(({ standing }) => viewReads(view, 'improvise', standing)),
)

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
    /** An expansion: the step's sub-steps in order, at least two. One in the words of a sub-step the step holds is that sub-step, given again. */
    | { add: 'steps'; to: string; steps: readonly SubStepEntry[] }

/**
 * The step record (calibration AGENT.md, The action plan): the step restated, written by code from a reply's `says` and `intent`, with
 * `answered`, the detail asked of it where one was, which joins its `alreadyAnswers`. A `says` or `intent` other than the step's revises it:
 * its intent is the restatement's (or its old one, kept); a changed `says` takes a path minted afresh; and its other children stay, called
 * into question (the revision rule): each unchecked and stale, moved under the new path. Only a child's authority removes one. An intent given
 * where the step has none is a detail added, and revises nothing. A restatement as written keeps the step and its items as they are; from the
 * step's authority, it confirms an unchecked step, as giving an unchecked intent confirms it.
 */
export type PlanRestate = { restate: 'step'; to: string; says: string; intent?: string; answered?: string }

/**
 * A check: the kind's authority replaces an unchecked item with a confirmed one of the same kind, an opposite, a more nuanced
 * agreement, or the item as written. `to` is the step that holds the item, found by code. The old item and its children leave.
 */
export type PlanReplace =
    | { replace: string; to: string; kind: 'consequence'; with: ConsequenceEntry }
    | { replace: string; to: string; kind: 'rule'; with: RuleEntry }

/**
 * A removal (the minimal one): the kind's authority takes out an unchecked item it rejects, as a `replace` checks one. `to` is the step
 * that holds it, found by code. A consequence leaves with its rules; a rule leaves its consequence.
 */
export type PlanRemove = { remove: string; to: string; kind: 'consequence' | 'rule' }

/** A change once checked. */
export type PlanChange = PlanAddition | PlanRestate | PlanReplace | PlanRemove

/** What a consequence given again adds to the one held: the rules it names that the held one doesn't, and its thing, where the held one has none. */
type PlanDetail = { detail: string; to: string; thing?: SceneHandle; rules: readonly RuleEntry[] }

/** What the merge applies: the block's changes, with each repeated consequence as the details it adds. */
type Applied = PlanChange | PlanDetail

/**
 * An improvised thing as written: `{"add": "improvise", "handle", "gloss"}`. It is the plan's, not a step's, so it names no step (`to`), and is
 * merged apart from the {@link PlanChange}s, each of which is a step's.
 */
export type ImproviseEntry = { handle: SceneHandle; gloss: string }

export type AddKind = PlanAddition['add'] | 'improvise'

/** The additions a block takes by default: the sub-item kinds (`consequences`'), with no expansion. */
export const SUB_ITEM_ADDS: readonly AddKind[] = ['consequence', 'concern', 'possibility']

/** The kinds a `replace` takes: the ones that can be unchecked today (mine; another kind's form waits on a writer of it). */
export const REPLACEABLE: readonly AuthoredKind[] = ['consequence', 'rule']

/** What a merge holds to a step's own items, as against an expansion, a restatement or a replacement. */
type ItemAddition = Exclude<PlanAddition, { add: 'steps' }>

const isRestate = (change: Applied): change is PlanRestate => 'restate' in change
const isReplace = (change: Applied): change is PlanReplace => 'replace' in change
const isRemove = (change: Applied): change is PlanRemove => 'remove' in change
const isDetail = (change: Applied): change is PlanDetail => 'detail' in change
const isAddition = (change: Applied): change is PlanAddition => 'add' in change
const isExpansion = (change: Applied): change is Extract<PlanAddition, { add: 'steps' }> => isAddition(change) && change.add === 'steps'
const isItemAddition = (change: Applied): change is ItemAddition => isAddition(change) && change.add !== 'steps'
const isPossibility = (change: Applied): change is Extract<PlanAddition, { add: 'possibility' }> => isItemAddition(change) && change.add === 'possibility'
const isConsequence = (change: Applied): change is Extract<PlanAddition, { add: 'consequence' }> => isItemAddition(change) && change.add === 'consequence'

/** What a change block is merged against: the plan, the scene's handles, which the plan doesn't hold (mine), and who wrote it. */
export type PlanChangesInput = { plan: ActionPlan; handles: readonly SceneHandle[]; author: PlanAuthor }

const CHANGE_KEYS = ['add', 'to', 'thing', 'says']
const IMPROVISE_KEYS = ['add', 'handle', 'gloss']
const CONSEQUENCE_KEYS = ['add', 'to', 'thing', 'says', 'rules']
const POSSIBILITY_KEYS = ['add', 'to', 'kind', 'says', 'branches']
const STEPS_KEYS = ['add', 'to', 'steps']
const RESTATE_KEYS = ['restate', 'to', 'says', 'intent', 'answered']
const REPLACE_KEYS = ['replace', 'with']
const REMOVE_KEYS = ['remove']
const BRANCH_KEYS = ['add', 'thing', 'says']
const SUB_STEP_KEYS = ['says', 'intent', 'consequences']
const CONSEQUENCE_ENTRY_KEYS = ['says', 'thing', 'rules']
const RULE_KEYS = ['rule', 'stance']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * What a merge takes, and how it words a refusal:
 * - `author`: the piece that wrote the block, which sets each item's standing by `AUTHORITY`;
 * - `handlesAre`: what a `thing` outside the handles is, `in the scene` when the handles are the scene's (the default), or as the caller
 *   names its handles, such as `a listed thing or named by the step` for `consequences`;
 * - `adds`: the additions it takes, by default the sub-item kinds (`SUB_ITEM_ADDS`); `playByPlay` takes `steps` and `consequence`,
 *   `triage` those and `improvise`;
 * - `restates`: whether it takes a `restate`, the step record, by default not; `playByPlay`'s does;
 * - `rules`: the rule handles a consequence may name, the ones the scene shows, by default none;
 * - `replaces`: whether it takes a `replace` or a `remove`, a check of an unchecked item, by default not (no piece checks yet).
 */
export type MergeOptions = {
    author: PlanAuthor
    handlesAre?: string
    adds?: readonly AddKind[]
    restates?: boolean
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
    restates: boolean
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

/** Whether two handles are the same: a letter-and-number word is a thing's in any case, as {@link bracketHandles} has it. */
const sameHandle = (one: SceneHandle, other: SceneHandle): boolean => one.toLowerCase() === other.toLowerCase()

const isImprovise = (entry: unknown): entry is Record<string, unknown> => isRecord(entry) && entry.add === 'improvise'

/** Whether a text could be a handle: one word, without brackets. */
const isHandle = (text: string): boolean => /^[^\s[\]]+$/.test(text)

/** The handles that improvised things are given, those that could be handles: what else in their block may name them. */
export const improvisedHandles = (entries: readonly unknown[]): SceneHandle[] => entries.flatMap((entry) => {
    const handle = isRecord(entry) ? handleOf(entry.handle) : undefined
    return handle !== undefined && isHandle(handle) ? [handle] : []
})

/** What an improvised thing is checked against: the handles its block may not give, and the things the plan has improvised. */
type ImproviseContext = Pick<CheckContext, 'handles' | 'rules' | 'adds' | 'author'> & { held: readonly ImproviseItem[]; earlier: readonly SceneHandle[] }

/**
 * An improvised thing checked: one the merge takes, a handle that is no scene thing's, rule's or earlier one's in the block, and a gloss. The
 * caller may pass held ones among its handles, so one held isn't taken for the scene's. A confirmed one's gloss is its authority's to change.
 */
const checkImprovise = (entry: Record<string, unknown>, { handles, rules, adds, author, held, earlier }: ImproviseContext): { improvise: ImproviseEntry } | { problems: string[] } => {
    const handle = handleOf(entry.handle)
    const gloss = isNonEmpty(entry.gloss) ? entry.gloss.trim() : undefined
    const among = (list: readonly SceneHandle[]): boolean => handle !== undefined && list.some((one) => sameHandle(one, handle))
    const found = held.find((item) => handle !== undefined && sameHandle(item.handle, handle))
    const problems = !adds.includes('improvise') ? [`"add" must be one of ${adds.join(', ')}`] : [
        ...extraKeyProblems(entry, IMPROVISE_KEYS),
        ...(handle === undefined ? ['has no string "handle"']
            : !isHandle(handle) ? [`"${handle}" is not a handle`]
            : among(rules) ? [`[${handle}] is a rule's handle`]
            : among(earlier) ? [`[${handle}] is improvised twice`]
            : found === undefined && among(handles) ? [`[${handle}] is in the scene already`]
            : found?.standing === 'confirmed' && gloss !== undefined && gloss !== found.gloss && AUTHORITY.improvise !== author ? [`[${found.handle}] is confirmed; only ${AUTHORITY.improvise} changes it`]
            : []),
        ...(gloss === undefined ? ['has no non-empty string "gloss"'] : []),
    ]
    return problems.length > 0 || handle === undefined || gloss === undefined ? { problems } : { improvise: { handle: found?.handle ?? handle, gloss } }
}

/**
 * A plan's improvised things with a block's. A handle held is that thing given again: another gloss takes the old one's place at its author's
 * standing, and one as written is confirmed by its authority, and otherwise no change. Its gloss is what nothing hangs from, so no step is
 * called into question; and none is dropped, by a block that leaves it out or a step that no longer names it.
 */
const withImprovises = (held: readonly ImproviseItem[], given: readonly ImproviseEntry[], author: PlanAuthor): ImproviseItem[] => given.reduce<ImproviseItem[]>((items, entry) => {
    const item: ImproviseItem = { ...entry, standing: standingOf('improvise', author) }
    return items.some(({ handle }) => handle === entry.handle)
        ? items.map((old) => (old.handle !== entry.handle || (old.gloss === entry.gloss && item.standing === 'unchecked') ? old : item))
        : [...items, item]
}, [...held])

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

/** A sub-step's `consequences`: absent, or a list of consequence entries, what that motion brings about. */
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

const isNonEmpty = (text: unknown): text is string => typeof text === 'string' && text.trim() !== ''

/** A restatement checked: one the merge takes, a `to` naming a step, a `says`, and where given an `intent` and the detail it answers. */
const checkRestate = (entry: Record<string, unknown>, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    const { restate, to, says, intent, answered } = entry
    const target = typeof to === 'string' ? to.trim() : undefined
    const problems = [
        ...(context.restates ? [] : ['"restate" isn\'t a change this block takes']),
        ...extraKeyProblems(entry, RESTATE_KEYS),
        ...(restate === 'step' ? [] : ['"restate" must be step']),
        ...targetProblems(target, context),
        ...saysProblems(says),
        ...(intent === undefined || isNonEmpty(intent) ? [] : ['"intent" is not a non-empty string']),
        ...(answered === undefined || isNonEmpty(answered) ? [] : ['"answered" is not a non-empty string']),
    ]
    return problems.length > 0 || target === undefined || !isNonEmpty(says)
        ? { problems }
        : { change: { restate: 'step', to: target, says, ...(isNonEmpty(intent) ? { intent } : {}), ...(isNonEmpty(answered) ? { answered: answered.trim() } : {}) } }
}

/**
 * A replacement checked: one the merge takes, naming an unchecked consequence or rule, from that kind's authority, with a `with`
 * of the same kind. A consequence's `with` is a consequence entry; a rule's is a rule entry.
 */
/** What a check (`replace` or `remove`) names: the item, or why it names none it may check. */
const checkedItem = (key: 'replace' | 'remove', value: unknown, context: CheckContext): { path?: string; found?: IndexedItem; problems: string[] } => {
    const [verb, done] = key === 'replace' ? ['replace', 'replaced'] : ['remove', 'removed']
    const path = typeof value === 'string' ? value.trim() : undefined
    const found = path === undefined ? undefined : context.items.get(path)
    const named = path === undefined ? [`"${key}" is not a string path`]
        : found !== undefined ? []
        : context.stepPaths.has(path) ? [`${verb} "${path}" names a step; a step isn't ${done}`]
        : [`${verb} "${path}" names no item`]
    const standing = found === undefined ? []
        : !REPLACEABLE.includes(found.kind) ? [`${verb} takes a consequence or a rule, not ${/^[aeiou]/.test(found.kind) ? 'an' : 'a'} ${found.kind}`]
        : [
            ...(found.standing === 'confirmed' ? [`"${path}" is confirmed; only an unchecked item is ${done}`] : []),
            ...(AUTHORITY[found.kind] === context.author ? [] : [`only ${AUTHORITY[found.kind]} ${verb}s a ${found.kind}; this block is ${context.author}'s`]),
        ]
    return { path, found, problems: [...(context.replaces ? [] : [`"${key}" isn't a change this block takes`]), ...named, ...standing] }
}

/** A removal checked: one the merge takes, naming an unchecked consequence or rule, from that kind's authority. */
const checkRemove = (entry: Record<string, unknown>, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    const { path, found, problems: named } = checkedItem('remove', entry.remove, context)
    const problems = [...extraKeyProblems(entry, REMOVE_KEYS), ...named]
    return problems.length > 0 || path === undefined || found === undefined || (found.kind !== 'consequence' && found.kind !== 'rule')
        ? { problems }
        : { change: { remove: path, to: found.step, kind: found.kind } }
}

const checkReplace = (entry: Record<string, unknown>, context: CheckContext): { change: PlanChange } | { problems: string[] } => {
    const { path, found, problems: named } = checkedItem('replace', entry.replace, context)
    const replacement = entry.with
    const shapedAs = !isRecord(replacement) ? undefined : 'rule' in replacement || 'stance' in replacement ? 'rule' : 'consequence'
    const withChecked = found === undefined || !REPLACEABLE.includes(found.kind) ? undefined
        : !isRecord(replacement) ? { problems: ['"with" is not an object'] }
        : shapedAs !== found.kind ? { problems: [`"with" is a ${shapedAs}; "${path}" is a ${found.kind}`] }
        : found.kind === 'rule' ? checkRule(replacement, context) : checkConsequenceEntry(replacement, context)
    const problems = [
        ...extraKeyProblems(entry, REPLACE_KEYS),
        ...named,
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
    if ('restate' in entry) {
        return checkRestate(entry, context)
    }
    if ('replace' in entry) {
        return checkReplace(entry, context)
    }
    if ('remove' in entry) {
        return checkRemove(entry, context)
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

/** What each change's paths are minted from, depth first: a possibility, then each branch and its consequences in order; a detail's, its rules. */
const changeSources = (change: ItemAddition | PlanReplace | PlanDetail): PathSource[] => (
    isDetail(change) ? change.rules.map(({ rule }) => ruleSource(rule))
        : isReplace(change) ? (change.kind === 'rule' ? [ruleSource(change.with.rule)] : consequenceSources(change.with))
        : change.add === 'possibility'
            ? [pathSource(change.openness, change.says), ...change.branches.flatMap((branch) => [pathSource('maybe', ''), ...branch.map(({ says }) => pathSource('consequence', says))])]
            : change.add === 'consequence' ? consequenceSources(change) : [pathSource(change.add, change.says)]
)

/** Rules as items, their paths taken in order from `paths`; their standing by their authority. */
const ruleItems = (rules: readonly RuleEntry[], author: PlanAuthor, paths: readonly string[]): RuleItem[] =>
    rules.map(({ rule, stance }, index) => ({ kind: 'rule', path: paths[index], standing: standingOf('rule', author), rule, stance }))

/** A consequence as an item, its path then its rules' taken in order from `paths`; its own standing given, its rules' by their authority. */
const consequenceItem = ({ says, thing, rules = [] }: ConsequenceEntry, standing: Standing, author: PlanAuthor, paths: readonly string[]): ConsequenceItem => ({
    kind: 'consequence',
    path: paths[0],
    standing,
    says,
    ...(thing === undefined ? {} : { thing }),
    ...(rules.length === 0 ? {} : { rules: ruleItems(rules, author, paths.slice(1)) }),
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

type Accepted = { index: number; change: PlanChange }

/** A step's intent, if it has one. */
const intentItem = ({ items }: StepNode): Extract<StepItem, { kind: 'intent' }> | undefined => items.find((item): item is Extract<StepItem, { kind: 'intent' }> => item.kind === 'intent')

/** Whether a restatement changes its step's words. */
const rewords = (step: StepNode, { says }: PlanRestate): boolean => says.trim() !== step.says.trim()

/** Whether a restatement changes its step's intent: it gives one other than the step's. One given where the step has none is added, and changes nothing. */
const changesIntent = (step: StepNode, { intent }: PlanRestate): boolean => {
    const held = intentItem(step)
    return intent !== undefined && held !== undefined && intent.trim() !== held.says.trim()
}

/** Whether a restatement revises its step: a `says`, or a given `intent`, other than the step's. */
const revises = (step: StepNode, restate: PlanRestate): boolean => rewords(step, restate) || changesIntent(step, restate)

/** At most one `execution` possibility per step, counting the block's and the plan's confirmed one. An unchecked one is a proposal, which a new one overwrites. */
const possibilityLimitProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        if (!isPossibility(change)) {
            return []
        }
        const held = (steps.get(change.to)?.items.some((item) => item.kind === 'possibility' && item.openness === change.openness && item.standing === 'confirmed') ?? false)
        const earlier = accepted.some((other) => other.index < index && isPossibility(other.change) && other.change.to === change.to && other.change.openness === change.openness)
        return held || earlier ? [`change ${index + 1}: step ${change.to} already has an ${change.openness} possibility; a step holds at most one`] : []
    })

/**
 * Whether two consequences say the same: their text, and their things where both give one. A thing on one side only matches (the user,
 * 2026-11-20): batch 44's concession r1 gave the cell's thingless proposal again with `"thing": "[table1]"`. Their rules are details, merged
 * one by one, so they don't tell two consequences apart (the user, 2026-11-24).
 */
const sameConsequence = (one: ConsequenceEntry, other: ConsequenceEntry): boolean =>
    one.says.trim() === other.says.trim() && (one.thing === undefined || other.thing === undefined || one.thing === other.thing)

/** Whether two rule entries are the same claim: the rule, and the stance on it. */
const sameRule = (one: RuleEntry, other: RuleEntry): boolean => one.rule.trim() === other.rule.trim() && one.stance === other.stance

/** The rules given that aren't among those held, each once. */
const newRules = (held: readonly RuleEntry[], given: readonly RuleEntry[]): RuleEntry[] =>
    given.reduce<RuleEntry[]>((added, rule) => ([...held, ...added].some((other) => sameRule(other, rule)) ? added : [...added, rule]), [])

/** A consequence the block's are matched against: one its step holds, or one an earlier change of the block adds, with what later ones gave it. */
type KnownConsequence = { to: string; says: string; thing?: SceneHandle; rules: readonly RuleEntry[]; held?: ConsequenceItem; at?: number; gained: { thing?: SceneHandle; rules: readonly RuleEntry[] } }

/** A known consequence with what the same one given again adds: its new rules; and its thing where the known one has none, unless it is confirmed, as a thing has no standing of its own. */
const withDetails = (known: KnownConsequence, { thing, rules = [] }: ConsequenceEntry, index: number): KnownConsequence => {
    const added = newRules(known.rules, rules)
    const filled = thing !== undefined && known.thing === undefined && known.held?.standing !== 'confirmed'
    return added.length === 0 && !filled ? known : {
        ...known,
        ...(filled ? { thing } : {}),
        rules: [...known.rules, ...added],
        at: known.at ?? index,
        gained: { ...known.gained, ...(filled ? { thing } : {}), rules: [...known.gained.rules, ...added] },
    }
}

/**
 * The block with its repeats as details (the user, 2026-11-20 and 2026-11-24): a consequence its step already holds
 * ({@link sameConsequence}), or that an earlier change of the block adds, isn't added again. What it gives that the first didn't is a detail
 * merged into that one, by that detail's own rules, and one that gives nothing new is no change. The record gives a kept item again when it
 * revises (the coat example), and did so where nothing was revised (batch 44, the concession cell r1), which minted a second copy. A revised
 * step keeps its children (the revision rule), so a child given again is a repeat too. Any author. An item the block replaces or removes isn't
 * matched. Only an item's authority settles a stale one by giving it again (the user, 2026-11-21): a check as written, so it is confirmed and
 * no longer stale. `refreshed` holds, by step, the paths of those. Another author's repeat leaves the mark, as a revising `playByPlay`'s does.
 */
const withRepeatsAsDetails = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[], author: PlanAuthor): { kept: { index: number; change: Applied }[]; refreshed: ReadonlyMap<string, ReadonlySet<string>> } => {
    const checked = new Set(accepted.flatMap(({ change }) => checkedPath(change) ?? []))
    const held = [...new Set(accepted.flatMap(({ change }) => (isConsequence(change) ? [change.to] : [])))].flatMap((to) => (steps.get(to)?.items ?? []).flatMap((item): KnownConsequence[] => (
        item.kind === 'consequence' && !checked.has(item.path) ? [{ to, says: item.says, ...(item.thing === undefined ? {} : { thing: item.thing }), rules: item.rules ?? [], held: item, gained: { rules: [] } }] : []
    )))
    const { known, settled } = accepted.reduce<{ known: KnownConsequence[]; settled: { to: string; path: string }[] }>((acc, { index, change }) => {
        if (!isConsequence(change)) {
            return acc
        }
        const same = acc.known.flatMap((known, at) => (known.to === change.to && sameConsequence(known, change) ? [at] : []))
        // The one on the same thing first, when the step holds one with it and one without.
        const found = same.find((at) => acc.known[at].thing === change.thing) ?? same[0]
        if (found === undefined) {
            const rules = newRules([], change.rules ?? [])
            return { ...acc, known: [...acc.known, { to: change.to, says: change.says, ...(change.thing === undefined ? {} : { thing: change.thing }), rules, at: index, gained: { rules: [] } }] }
        }
        const item = acc.known[found].held
        const again = item === undefined ? [] : [
            ...(item.stale && AUTHORITY.consequence === author ? [item.path] : []),
            ...(AUTHORITY.rule === author ? (item.rules ?? []).filter((rule) => rule.stale && (change.rules ?? []).some((given) => sameRule(given, rule))).map(({ path }) => path) : []),
        ]
        return {
            known: acc.known.map((known, at) => (at === found ? withDetails(known, change, index) : known)),
            settled: [...acc.settled, ...again.map((path) => ({ to: change.to, path }))],
        }
    }, { known: held, settled: [] })
    const byIndex = new Map(known.flatMap(({ to, says, thing, rules, held: item, at, gained }): [number, Applied][] => (
        at === undefined ? []
            : item !== undefined ? [[at, { detail: item.path, to, ...gained }]]
            : [[at, { add: 'consequence', to, says, ...(thing === undefined ? {} : { thing }), ...(rules.length === 0 ? {} : { rules }) }]]
    )))
    return {
        kept: accepted.flatMap(({ index, change }) => {
            const applied = isConsequence(change) ? byIndex.get(index) : change
            return applied === undefined ? [] : [{ index, change: applied }]
        }),
        refreshed: settled.reduce<Map<string, Set<string>>>((acc, { to, path }) => new Map([...acc, [to, new Set([...(acc.get(to) ?? []), path])]]), new Map()),
    }
}

/** The item a check names: a replacement's or a removal's. */
const checkedPath = (change: PlanChange): string | undefined => (isReplace(change) ? change.replace : isRemove(change) ? change.remove : undefined)

/** An item is checked (replaced or removed) at most once in a block. */
const replaceProblems = (accepted: readonly Accepted[]): string[] =>
    accepted.flatMap(({ index, change }) => {
        const path = checkedPath(change)
        return path !== undefined && accepted.some((other) => other.index < index && checkedPath(other.change) === path)
            ? [`change ${index + 1}: "${path}" is already replaced or removed in this block`]
            : []
    })

/** Whether an earlier change in the block passes `test` and is aimed at the same step. */
const earlierTo = (accepted: readonly Accepted[], { index, change }: Accepted, test: (other: PlanChange) => boolean): boolean =>
    accepted.some((other) => other.index < index && other.change.to === change.to && test(other.change))

/**
 * A step is expanded at most once, more detail going into its sub-steps (the user, 2026-11-18), counting the plan's sub-steps once any is
 * guarded as confirmed, and the block's earlier changes. A block that expands a step addresses none of the sub-steps it held, which may leave.
 */
const expansionProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[]): string[] => {
    const within = new Map(accepted.flatMap(({ change }) => {
        const step = isExpansion(change) ? steps.get(change.to) : undefined
        return step === undefined ? [] : withSubSteps(step).slice(1).map(({ path }): [string, string] => [path, step.path])
    }))
    return accepted.flatMap((entry) => {
        const { index, change } = entry
        const step = steps.get(change.to)
        const closed = step === undefined || !isExpansion(change) ? undefined
            : expansionClosed(step) ?? (earlierTo(accepted, entry, isExpansion) ? `step ${change.to} is already expanded; expand one of its sub-steps for more detail` : undefined)
        const outer = within.get(change.to)
        return [
            ...(closed === undefined ? [] : [`change ${index + 1}: ${closed}`]),
            ...(outer === undefined ? [] : [`change ${index + 1}: to "${change.to}" is a sub-step of ${outer}, which this block expands`]),
        ]
    })
}

/**
 * A step is restated at most once in a block. Its words change only where {@link rewordingClosed} leaves them open to the author, and its intent
 * only where it is unchecked, or the author is its authority; neither changes under sub-steps guarded as confirmed. A check on an item of a step
 * the block revises is taken: the item stays, under the new path.
 */
const restateProblems = (steps: ReadonlyMap<string, StepNode>, accepted: readonly Accepted[], author: PlanAuthor): string[] =>
    accepted.flatMap((entry) => {
        const { index, change } = entry
        const step = steps.get(change.to)
        if (step === undefined || !isRestate(change)) {
            return []
        }
        const intent = intentItem(step)
        const reworded = rewords(step, change) ? rewordingClosed(step, author) : undefined
        const reintended = !changesIntent(step, change) || reworded !== undefined ? undefined
            : expansionClosed(step) !== undefined ? rewordingClosed(step, author)
            : intent?.standing === 'confirmed' && AUTHORITY.intent !== author ? `intent ${intent.path} is confirmed; only ${AUTHORITY.intent} changes it`
            : undefined
        return [
            ...(earlierTo(accepted, entry, isRestate) ? [`step ${change.to} is already restated in this block`] : []),
            ...(reworded === undefined ? [] : [reworded]),
            ...(reintended === undefined ? [] : [reintended]),
        ].map((problem) => `change ${index + 1}: ${problem}`)
    })

/**
 * A step's items with each checked path's item gone, its children with it; a checked rule leaves its consequence, with no `rules` once
 * its last goes. The scope a replacement is minted against.
 */
const withoutReplaced = (items: readonly StepItem[], replaced: ReadonlySet<string>): StepItem[] => items
    .filter(({ path }) => !replaced.has(path))
    .map((item) => {
        if (item.kind !== 'consequence' || item.rules === undefined || !item.rules.some(({ path }) => replaced.has(path))) {
            return item
        }
        const { rules, ...rest } = item
        const left = rules.filter(({ path }) => !replaced.has(path))
        return left.length === 0 ? rest : { ...rest, rules: left }
    })

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

/** A path under one step's moved under another's: the same slug, in the same scope. */
const rebased = (path: string, from: string, to: string): string => (path.startsWith(`${from}.`) ? `${to}${path.slice(from.length)}` : path)

/**
 * A revised step's child, called into question (the revision rule): unchecked, stale, under the step's new path; a consequence's rules with it.
 * A revision by anyone but the step's authority (`proposed`) is a proposal, which calls only proposals into question, so what is confirmed
 * stays as it is (the user, 2026-11-24); a sub-step's path is its own, so it doesn't move.
 */
const questioned = (item: Exclude<StepItem, { kind: 'intent' }>, from: string, to: string, proposed: boolean): StepItem => {
    const at = (path: string) => rebased(path, from, to)
    const mark = <Item extends { path: string; standing: Standing }>(one: Item): Item =>
        ({ ...one, path: at(one.path), ...(proposed && one.standing === 'confirmed' ? {} : { standing: 'unchecked', stale: true }) })
    if (item.kind === 'step') {
        return { ...item, stale: true }
    }
    if (item.kind === 'consequence') {
        return { ...mark(item), ...(item.rules === undefined ? {} : { rules: item.rules.map(mark) }) }
    }
    if (item.kind === 'possibility') {
        return { ...mark(item), branches: item.branches.map((branch) => ({ ...branch, path: at(branch.path), items: branch.items.map((consequence) => ({ ...consequence, path: at(consequence.path) })) })) }
    }
    return mark(item)
}

/**
 * A step's intent once restated, under the step's path. Left out, it is as it was: the restatement says nothing of it (mine). As written, it
 * takes the author's standing for an intent where it is unchecked, so its authority (`playByPlay`) confirms it, as a `replace` with the item as
 * written confirms; a confirmed one is never lowered (mine, the user agreeing, 2026-11-20). Otherwise it is the restatement's.
 */
const restatedIntent = (step: StepNode, { intent }: PlanRestate, path: string, author: PlanAuthor): StepItem[] => {
    const old = intentItem(step)
    if (old !== undefined && (intent === undefined || intent.trim() === old.says.trim())) {
        return [{ ...old, path: `${path}.intent`, ...(intent !== undefined && old.standing === 'unchecked' ? { standing: standingOf('intent', author) } : {}) }]
    }
    return intent === undefined ? [] : [{ kind: 'intent', path: `${path}.intent`, standing: standingOf('intent', author), says: intent }]
}

/**
 * A restated step's own items before the block's additions: its intent ({@link restatedIntent}), and every other child kept, called into
 * question (`questioned`) when the restatement revises, all under the step's path. Only a child's authority removes one, on checking it; the
 * reviser can't drop a child by leaving it out (the revision rule).
 */
const restatedItems = (step: StepNode, restate: PlanRestate, path: string, author: PlanAuthor): StepItem[] => {
    const others = step.items.filter((item): item is Exclude<StepItem, { kind: 'intent' }> => item.kind !== 'intent')
    return [
        ...restatedIntent(step, restate, path, author),
        ...(revises(step, restate) ? others.map((item) => questioned(item, step.path, path, AUTHORITY.step !== author)) : others),
    ]
}

/** Without the stale mark: its authority has settled it. */
const unstale = <Item extends Stale>({ stale: _stale, ...rest }: Item) => rest

/**
 * A stale consequence its authority gives again (the revision rule): confirmed, no longer stale; and so a stale rule. Each settles only its own
 * mark: a consequence's rules are the rule cell's.
 */
const refreshedItem = (item: StepItem, fresh: ReadonlySet<string>): StepItem => {
    if (item.kind !== 'consequence') {
        return item
    }
    const rules = item.rules?.some(({ path }) => fresh.has(path)) ? item.rules.map((rule): RuleItem => (fresh.has(rule.path) ? { ...unstale(rule), standing: 'confirmed' } : rule)) : item.rules
    const own: ConsequenceItem = fresh.has(item.path) ? { ...unstale(item), standing: 'confirmed' } : item
    return rules === undefined ? own : { ...own, rules }
}

/** A step's answered details with one more, unless it is already there. */
const withAnswer = (answers: readonly string[] = [], answered: string): readonly string[] => (answers.includes(answered) ? answers : [...answers, answered])

/** A step's items with each detail in its consequence: the rules added after its own, and the thing where one is given. */
const withDetailsIn = (items: readonly StepItem[], details: readonly { change: PlanDetail; paths: readonly string[] }[], author: PlanAuthor): StepItem[] =>
    items.map((item) => {
        const found = details.find(({ change }) => change.detail === item.path)
        if (found === undefined || item.kind !== 'consequence') {
            return item
        }
        const { change: { thing, rules }, paths } = found
        return { ...item, ...(thing === undefined ? {} : { thing }), ...(rules.length === 0 ? {} : { rules: [...(item.rules ?? []), ...ruleItems(rules, author, paths)] }) }
    })

/** Which of a step's sub-steps each entry of an expansion is, by its words, each held one once; `undefined` for a new one. */
const heldSubSteps = ({ items }: StepNode, entries: readonly SubStepEntry[]): (SubStep | undefined)[] => {
    const held = items.filter((item): item is SubStep => item.kind === 'step')
    return entries.reduce<{ found: (SubStep | undefined)[]; left: readonly SubStep[] }>(({ found, left }, { says }) => {
        const match = left.find((item) => item.says.trim() === says.trim())
        return { found: [...found, match], left: left.filter((item) => item !== match) }
    }, { found: [], left: held }).found
}

/**
 * A sub-step as an expansion gives it, its own block of changes applied: its intent and the consequences that motion brings about, with their
 * rules. A new one is its author's, at a step path minted for it. One in the words of a sub-step held (`held`) is that one given again, so it
 * keeps its path and every claim made on it, and its details merge as any restated step's; its authority confirms it. Each standing by
 * `author`: from `playByPlay`, the sub-step and its intent confirmed, the rest unchecked.
 */
const subStepItem = ({ says, intent, consequences = [] }: SubStepEntry, path: string, held: SubStep | undefined, author: PlanAuthor): SubStep => {
    const step: SubStep = held ?? { kind: 'step', path, standing: standingOf('step', author), says, suppliedBy: 'system', items: [] }
    const changes = [
        { restate: 'step' as const, to: step.path, says: step.says, ...(intent === undefined ? {} : { intent }) },
        ...consequences.map((entry) => ({ add: 'consequence' as const, to: step.path, ...entry })),
    ].map((change, index) => ({ index, change }))
    const { kept, refreshed } = withRepeatsAsDetails(new Map([[step.path, step]]), changes, author)
    return updated(step, applyChanges(step, kept, new Map(), undefined, author, refreshed.get(step.path)))
}

/**
 * A step with the block's changes to it applied: a restatement first, its children called into question when it revises, and its path
 * `revisedPath` when its `says` changed; the stale items their authority gave again (`refreshed`) confirmed; then checked items removed, so a
 * confirmation as written mints its old path again, and an unchecked possibility the block overwrites; additions, details and replacements
 * minted in its own scope, in block order; sub-steps in place of those it held, a new one's path from `subStepPaths`; a restatement's detail
 * added to `alreadyAnswers`.
 */
const applyChanges = (
    step: StepNode, changes: readonly { index: number; change: Applied }[], subStepPaths: ReadonlyMap<number, readonly string[]>, revisedPath: string | undefined, author: PlanAuthor,
    refreshed: ReadonlySet<string> = new Set(),
): StepUpdate => {
    const restate = changes.map(({ change }) => change).find(isRestate)
    const path = revisedPath ?? step.path
    const moved = (item: string): string => rebased(item, step.path, path)
    const restated = restate === undefined ? step.items : restatedItems(step, restate, path, author)
    const fresh = new Set([...refreshed].map(moved))
    const own = fresh.size === 0 ? restated : restated.map((item) => refreshedItem(item, fresh))
    // A check or a detail names an item by the path it had when the block was written; a revision in the same block may have moved it.
    const minted = changes.map(({ change }) => change).flatMap((change): (ItemAddition | PlanReplace | PlanDetail)[] => (
        isItemAddition(change) ? [change]
            : isReplace(change) ? [{ ...change, replace: moved(change.replace) }]
            : isDetail(change) ? [{ ...change, detail: moved(change.detail) }] : []
    ))
    const replaces = minted.filter(isReplace)
    const opened = minted.filter(isPossibility).map(({ openness }) => openness)
    const overwritten = own.flatMap((item) => (item.kind === 'possibility' && opened.includes(item.openness) ? [item.path] : []))
    const removed = new Set([...changes.map(({ change }) => change).filter(isRemove).map(({ remove }) => moved(remove)), ...overwritten])
    const kept = withoutReplaced(own, new Set([...replaces.map(({ replace }) => replace), ...removed]))
    const sources = minted.map(changeSources)
    const paths = mintPaths(sources.flat(), scopePaths(kept).map((scoped) => scoped.slice(path.length + 1)))
    type Placed<Change> = { change: Change; paths: string[] }
    const placed = minted.reduce<{ items: StepItem[]; replacements: Placed<PlanReplace>[]; details: Placed<PlanDetail>[]; next: number }>((acc, change, index) => {
        const slugs = paths.slice(acc.next, acc.next + sources[index].length)
        const own = { paths: slugs.map((slugged) => `${path}.${slugged}`) }
        const next = acc.next + slugs.length
        return isReplace(change) ? { ...acc, replacements: [...acc.replacements, { change, ...own }], next }
            : isDetail(change) ? { ...acc, details: [...acc.details, { change, ...own }], next }
            : { ...acc, items: [...acc.items, changeItem(change, path, slugs, author)], next }
    }, { items: [], replacements: [], details: [], next: 0 })
    const items = withDetailsIn(withReplacements(withoutReplaced(own, removed), placed.replacements, author), placed.details, author)
    const expansion = changes.flatMap(({ index, change }) => (isExpansion(change) ? [{ index, change }] : []))[0]
    const heldAs = expansion === undefined ? [] : heldSubSteps(step, expansion.change.steps)
    const subSteps = expansion === undefined ? [] : expansion.change.steps.map((entry, at) => subStepItem(entry, subStepPaths.get(expansion.index)?.[at] ?? '', heldAs[at], author))
    // Its words, changed or given as written, are its authority's once its authority restates it; a proposal's only when it changes them.
    const ruled = restate !== undefined && (AUTHORITY.step === author || rewords(step, restate))
    return {
        items: orderItems([...(expansion === undefined ? items : items.filter(({ kind }) => kind !== 'step')), ...placed.items, ...subSteps]),
        ...(restate !== undefined && revises(step, restate) ? { path, says: restate.says } : {}),
        ...(ruled ? { standing: standingOf('step', author) } : {}),
        ...(ruled && AUTHORITY.step === author && step.stale ? { stale: undefined } : {}),
        ...(restate?.answered === undefined ? {} : { alreadyAnswers: withAnswer(step.alreadyAnswers, restate.answered) }),
    }
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
 * otherwise be dropped unseen (`consequences`' batch 4, a `"concerns"` key). An improvised thing is the plan's, and the block's other changes
 * may name it, wherever it stands there; those the plan holds are the caller's to pass among the handles.
 */
export const mergeChanges = (
    plan: ActionPlan, block: unknown, handles: readonly SceneHandle[],
    { author, handlesAre = 'in the scene', adds = SUB_ITEM_ADDS, restates = false, rules = [], replaces = false }: MergeOptions,
): { plan: ActionPlan } | { problems: string[] } => {
    const changes = isRecord(block) ? block.changes : undefined
    const besides = isRecord(block) ? Object.keys(block).filter((key) => key !== 'changes').map((key) => `the JSON block has "${key}"; everything it adds goes in "changes"`) : []
    if (!Array.isArray(changes)) {
        return { problems: [isRecord(block) ? 'the JSON block has no "changes" array' : 'the change block is not an object', ...besides] }
    }
    const steps = new Map(planSteps(plan).map((step) => [step.path, step]))
    const itemPathSet = new Set([...steps.values()].flatMap(({ items }) => scopePaths(items)))
    const held = plan.improvised ?? []
    const context: CheckContext = {
        stepPaths: new Set(steps.keys()), itemPaths: itemPathSet, items: indexItems([...steps.values()]),
        handles: adds.includes('improvise') ? [...handles, ...improvisedHandles(changes.filter(isImprovise))] : handles,
        handlesAre, adds, restates, rules, replaces, author,
    }
    const checked = changes.map((entry, index) => (isImprovise(entry)
        ? checkImprovise(entry, { handles, rules, adds, author, held, earlier: improvisedHandles(changes.slice(0, index).filter(isImprovise)) })
        : checkChange(entry, context)))
    const accepted = checked.flatMap((result, index): Accepted[] => ('change' in result ? [{ index, change: result.change }] : []))
    const problems = [
        ...besides,
        ...checked.flatMap((result, index) => ('problems' in result ? result.problems.map((problem) => `change ${index + 1}: ${problem}`) : [])),
        ...possibilityLimitProblems(steps, accepted),
        ...expansionProblems(steps, accepted),
        ...restateProblems(steps, accepted, author),
        ...replaceProblems(accepted),
    ]
    if (problems.length > 0) {
        return { problems }
    }
    const improvised = withImprovises(held, checked.flatMap((result) => ('improvise' in result ? [result.improvise] : [])), author)
    const { kept, refreshed } = withRepeatsAsDetails(steps, accepted, author)
    // A revised step whose `says` changed takes a path minted afresh, its old one free again, before any sub-step's (mine).
    const renamed = accepted.flatMap(({ change }) => {
        const step = isRestate(change) ? steps.get(change.to) : undefined
        return step !== undefined && isRestate(change) && rewords(step, change) ? [change] : []
    })
    // An expansion's entries, each with the sub-step held that it gives again; the ones held that it doesn't leave, their paths free.
    const expansions = accepted.flatMap(({ index, change }) => {
        const step = isExpansion(change) ? steps.get(change.to) : undefined
        return step === undefined || !isExpansion(change) ? [] : [{ index, step, entries: change.steps, held: heldSubSteps(step, change.steps) }]
    })
    const left = expansions.flatMap(({ step, held }) => step.items.flatMap((item) => (item.kind === 'step' && !held.includes(item) ? withSubSteps(item).map(({ path }) => path) : [])))
    const vacated = new Set([...renamed.map(({ to }) => to), ...left])
    const minted = mintPaths(
        [...renamed.map(({ says }) => ({ says, fallback: 'step' })), ...expansions.flatMap(({ entries, held }) => entries.filter((_, at) => held[at] === undefined).map(({ says }) => ({ says, fallback: 'step' })))],
        [...steps.keys()].filter((path) => !vacated.has(path)),
    )
    const revisedPaths = new Map(renamed.map(({ to }, index) => [to, minted[index]]))
    const subStepPaths = new Map(expansions.reduce<{ pairs: [number, string[]][]; next: number }>((acc, { index, held }) => {
        const { paths, next } = held.reduce<{ paths: string[]; next: number }>(({ paths: given, next: at }, item) => (
            item === undefined ? { paths: [...given, minted[at]], next: at + 1 } : { paths: [...given, item.path], next: at }
        ), { paths: [], next: acc.next })
        return { pairs: [...acc.pairs, [index, paths]], next }
    }, { pairs: [], next: renamed.length }).pairs)
    const targets = [...new Set(accepted.map(({ change }) => change.to))]
    return {
        plan: withImprovised(targets.reduce<readonly PlannedStep[]>((built, target) => (
            built.map((step) => mapStep(step, target, (found) => applyChanges(found, kept.filter(({ change }) => change.to === target), subStepPaths, revisedPaths.get(target), author, refreshed.get(target))))
        ), plan.steps), improvised),
    }
}

/** Whether a change names the step it is for: all but a check, which names its item, and an improvised thing, which is the plan's. */
const takesTo = (entry: unknown): entry is Record<string, unknown> => isRecord(entry) && entry.add !== 'improvise' && !('replace' in entry) && !('remove' in entry)

/**
 * A change block scoped to one step, the one a generator expands: code supplies each change's
 * `to`, by the rule that an id a model writes is a reference waiting to break. A `to` the block does write must name the target;
 * otherwise the block is refused, as any problem refuses it. A `replace` or `remove` takes no `to`, and must name an item in the target's own scope;
 * an improvised thing takes none either, being the plan's.
 * Then `mergeChanges`. The scope reads only `to`, so a new `add` kind, or a restatement, passes through it to `checkChange`. The target may be a
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
        if (isImprovise(entry)) {
            return []
        }
        const checkKey = isRecord(entry) ? (['replace', 'remove'] as const).find((key) => key in entry) : undefined
        if (isRecord(entry) && checkKey !== undefined) {
            const named = entry[checkKey]
            return typeof named !== 'string' || scope.has(named.trim()) || !planSteps(plan).some(({ items }) => scopePaths(items).includes(named.trim()))
                ? []
                : [`change ${index + 1}: ${checkKey} "${named}" is not in the step being expanded, ${target}`]
        }
        const to = isRecord(entry) ? entry.to : undefined
        return to === undefined || (typeof to === 'string' && to.trim() === target)
            ? []
            : [`change ${index + 1}: to ${JSON.stringify(to)} is not the step being expanded, ${target}`]
    })
    if (problems.length > 0) {
        return { problems }
    }
    return mergeChanges(plan, { ...(block as Record<string, unknown>), changes: changes.map((entry) => (takesTo(entry) ? { ...entry, to: target } : entry)) }, handles, options)
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
