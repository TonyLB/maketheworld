/**
 * The multi-register renders (sceneProjection Slice 5, SP-10): the scene as the fiction (a place, in sentences) and again
 * as records (D's list), tied by handles. One function with two switches, because the contenders are axes, not packages:
 * `registers` has neither switch, `affordance` adds the foreground, `examples` adds generated worked examples, so each
 * differs from `registers` by one thing.
 *
 * The foreground states only rules the game encodes (positions contract, "Relation kinds"; `interactionUnderTransfer.ts`):
 * a secured thing blocks a move of either end until it is freed, and a hosted thing travels with its host (stated only
 * where nothing under it is spread over several hosts or a join, since then part of it stays). Nothing else
 * is stated: not that a Feature is fixed, and not what a secured descendant does to a lift of its ancestor (neither is
 * encoded as a rule).
 *
 * The worked examples are chosen by a fixed rule, about the scene's own handles:
 * - the consequence example is the first entry in walk order (the room's contents, then what is held) that has something
 *   under it, travels cleanly, is not fixed, and has no fixed thing under it: picking it up, what comes with it;
 * - the blocker example is the first thing in walk order secured to another thing in the scene: moving it.
 * An example whose shape the scene lacks is left out. Fixtures keep their probe questions clear of these subjects
 * (`sceneExamples.test.ts`), so an example never hands a question its answer.
 */
import type { SceneEntry, SceneHandle, SceneModel } from '../../positions/ludicCache/sceneModel'
import { sceneListLines, type RelationStyle } from './renderSceneTree'
import { bracket, exitsLine, heading, headText, hostingClause, lineNotes, relationPhrases, roomRef } from './sceneWording'

export type RegistersOptions = { foreground: boolean; examples: boolean; relationStyle?: RelationStyle }

type Parent = { kind: 'room' } | { kind: 'held' } | { kind: 'thing'; handle: SceneHandle }

const listWords = (words: readonly string[]): string => (
    words.length <= 2 ? words.join(' and ') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
)

/** Entries in walk order, each with all it holds under it, a join where it sits (the scene model's site for it). */
const walk = (entries: readonly SceneEntry[]): SceneEntry[] => entries.flatMap((entry) => [entry, ...walk(entry.children)])

export const sceneEntries = (scene: SceneModel): SceneEntry[] => [...walk(scene.contents), ...walk(scene.held)]

/** What travels with a thing is only clear when nothing in it is spread over several hosts or a join: its other bindings stay. */
const travelsCleanly = (entry: SceneEntry): boolean => [entry, ...walk(entry.children)].every((member) => (
    member.elsewhere.length === 0 && member.kind === 'line' && member.joins.length === 0
))

/** Whether a lift of the thing is clear of the secured: neither it nor anything under it is fixed. */
const movableAlone = (entry: SceneEntry, fixed: ReadonlySet<SceneHandle>): boolean => (
    [entry, ...walk(entry.children)].every(({ handle }) => !fixed.has(handle))
)

const subtreeHandles = (entry: SceneEntry): SceneHandle[] => walk(entry.children).map(({ handle }) => handle)

/** What each thing is secured to, for the targets that are things in the scene: a tie or a bare `SecuredTo`, either end blocks. */
type Securing = { subject: SceneHandle; target: SceneHandle; words: string }

const securings = (scene: SceneModel): Securing[] => (
    Object.entries(scene.things).flatMap(([subject, { relations }]) => relations.flatMap((relation): Securing[] => {
        if (relation.kind === 'Associated' || relation.target.kind !== 'thing') {
            return []
        }
        if (relation.kind === 'Custom' && relation.secured) {
            return [{ subject, target: relation.target.handle, words: `${relation.label} ${bracket(relation.target.handle)}` }]
        }
        return relation.kind === 'SecuredTo' ? [{ subject, target: relation.target.handle, words: `secured to ${bracket(relation.target.handle)}` }] : []
    }))
)

/** A secured relation to something not shown still holds its subject. */
const fixedHandles = (scene: SceneModel): Set<SceneHandle> => new Set([
    ...securings(scene).flatMap(({ subject, target }) => [subject, target]),
    ...Object.entries(scene.things).filter(([, { relations }]) => relations.some((relation) => (
        (relation.kind === 'SecuredTo') || (relation.kind === 'Custom' && relation.secured)
    ))).map(([handle]) => handle),
])

// -- The world register -------------------------------------------------------------------------------------------------

const itemText = (scene: SceneModel, entry: SceneEntry): string => [headText(scene, entry), ...lineNotes(scene, entry)].join(' ')

const isAre = (count: number): string => count === 1 ? 'is' : 'are'

/** A group's sentence: "On [table1] there are ...", "[arm1] is part of [chair1]." `target` is bracketed or a room ref. */
const groupSentence = (scene: SceneModel, entries: readonly SceneEntry[], hostingKind: SceneEntry['hostingKind'], target: string): string => {
    const list = listWords(entries.map((entry) => itemText(scene, entry)))
    switch (hostingKind) {
        case 'On': return `On ${target} there ${isAre(entries.length)} ${list}.`
        case 'PartOf':
        case 'SectionOf': return `${list} ${isAre(entries.length)} ${hostingClause(hostingKind, target)}.`
        case 'Held': return `You are holding ${list}.`
        default: return `In ${target} there ${isAre(entries.length)} ${list}.`
    }
}

const targetOf = (scene: SceneModel, entry: SceneEntry, parent: Parent): string => {
    if (entry.kind === 'join') {
        return bracket(entry.host)
    }
    return parent.kind === 'thing' ? bracket(parent.handle) : parent.kind === 'room' ? roomRef(scene) : 'you'
}

/** One sentence per (hosting kind, host) among `entries`, then (pre-order) the sentences about what is under each. */
const placeSentences = (scene: SceneModel, entries: readonly SceneEntry[], parent: Parent): string[] => {
    const groups = entries.reduce<{ hostingKind: SceneEntry['hostingKind']; target: string; entries: SceneEntry[] }[]>((found, entry) => {
        const target = targetOf(scene, entry, parent)
        const index = found.findIndex((group) => group.hostingKind === entry.hostingKind && group.target === target)
        return index >= 0
            ? found.map((group, at) => at === index ? { ...group, entries: [...group.entries, entry] } : group)
            : [...found, { hostingKind: entry.hostingKind, target, entries: [entry] }]
    }, [])
    return [
        ...groups.map(({ hostingKind, target, entries: group }) => groupSentence(scene, group, parent.kind === 'held' ? 'Held' : hostingKind, target)),
        ...entries.flatMap((entry) => [
            ...(entry.first
                ? relationPhrases(scene, entry.handle).map((phrase) => `${bracket(entry.handle)} is ${phrase.replace(/^is /, '')}.`)
                : []),
            ...placeSentences(scene, entry.children, { kind: 'thing', handle: entry.handle }),
        ]),
    ]
}

export const placeLines = (scene: SceneModel): string[] => [
    'The place:',
    ...(scene.contents.length === 0 ? [`In ${roomRef(scene)} there is nothing.`] : placeSentences(scene, scene.contents, { kind: 'room' })),
    ...(scene.held.length === 0 ? ['You are holding nothing.'] : placeSentences(scene, scene.held, { kind: 'held' })),
    ...(exitsLine(scene) !== undefined ? [exitsLine(scene) as string] : []),
]

const recordLines = (scene: SceneModel, style: RelationStyle): string[] => ['Records:', ...sceneListLines(scene, '  ', style)]

// -- The foreground -----------------------------------------------------------------------------------------------------

/** "[teapot1] and [table1] cannot be moved while [teapot1] is glued to [table1]." */
const fixedSentences = (scene: SceneModel): string[] => securings(scene).map(({ subject, target, words }) => (
    `${bracket(subject)} and ${bracket(target)} cannot be moved while ${bracket(subject)} is ${words}.`
))

/** "Moving [saucer1] also moves [cup1] and [tea1]." for each thing with something under it (once per thing). */
const travelSentences = (scene: SceneModel): string[] => {
    const fixed = fixedHandles(scene)
    return sceneEntries(scene)
        .filter((entry, index, all) => entry.children.length > 0 && travelsCleanly(entry) && movableAlone(entry, fixed) && all.findIndex(({ handle }) => handle === entry.handle) === index)
        .map((entry) => `Moving ${bracket(entry.handle)} also moves ${listWords(subtreeHandles(entry).filter((handle, at, all) => all.indexOf(handle) === at).map(bracket))}.`)
}

const foregroundLines = (scene: SceneModel): string[] => {
    const sentences = [...fixedSentences(scene), ...travelSentences(scene)]
    return sentences.length === 0 ? [] : ['Rules that apply here:', ...sentences.map((sentence) => `- ${sentence}`)]
}

// -- The worked examples ------------------------------------------------------------------------------------------------

export type ExampleSubjects = { consequence?: SceneHandle; blocker?: Securing }

/** The handles each worked example is about; a fixture's probe questions must stay clear of them. */
export const exampleSubjects = (scene: SceneModel): ExampleSubjects => {
    const fixed = fixedHandles(scene)
    const consequence = sceneEntries(scene).find((entry) => (
        entry.children.length > 0 && travelsCleanly(entry) && movableAlone(entry, fixed)
    ))
    const blocker = securings(scene).find(({ subject }) => sceneEntries(scene).some(({ handle }) => handle === subject))
    return { consequence: consequence?.handle, blocker }
}

/** The things the examples are about (the thing lifted, the secured pair), for the collision guard. Not what travels with them. */
export const exampleHandles = (scene: SceneModel): SceneHandle[] => {
    const { consequence, blocker } = exampleSubjects(scene)
    return [...(consequence !== undefined ? [consequence] : []), ...(blocker ? [blocker.subject, blocker.target] : [])]
}

const examplesLines = (scene: SceneModel): string[] => {
    const { consequence, blocker } = exampleSubjects(scene)
    const entry = sceneEntries(scene).find(({ handle }) => handle === consequence)
    const lines = [
        ...(entry === undefined ? [] : [
            `Example: if someone picks up ${bracket(entry.handle)}, what happens?`,
            `- In the world: ${listWords(subtreeHandles(entry).filter((handle, at, all) => all.indexOf(handle) === at).map(bracket))} ${subtreeHandles(entry).length === 1 ? 'comes' : 'come'} with it, and nothing else does.`,
            `- In the records: (move ${bracket(entry.handle)} to held). What is under it stays under it, so nothing else changes.`,
        ]),
        ...(blocker === undefined ? [] : [
            `Example: can ${bracket(blocker.subject)} be moved to the floor?`,
            `- In the world: not yet, because it is ${blocker.words}; it has to be freed first, and then it can be moved.`,
            `- In the records: (untie ${bracket(blocker.subject)} from ${bracket(blocker.target)}), then (move ${bracket(blocker.subject)} to the room).`,
        ]),
    ]
    return lines.length === 0 ? [] : ['Worked examples, about this scene:', ...lines]
}

export const renderSceneRegisters = (scene: SceneModel, { foreground, examples, relationStyle = 'clause' }: RegistersOptions): string => [
    heading(scene),
    ...(foreground ? foregroundLines(scene) : []),
    ...placeLines(scene),
    ...recordLines(scene, relationStyle),
    ...(examples ? examplesLines(scene) : []),
].join('\n')
