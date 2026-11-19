/**
 * The explicit render (AGENT.trialQuestion.planning.md, step 0; the user's idea, 2026-11-16): the scene with what a reading guide used to
 * teach said in English, thing by thing, so a prompt needs no "Reading the scene" section. The Fiction is the judge render's, unchanged.
 * In place of the Graph, `The things:` gives a line per thing, in the Graph's order, each saying:
 * - where it is, in words (only its own place, not its chain to the room);
 * - what is on it or in it, and a conditional carry line, with the physics left to the reader ("When [table1] moves, what is on it moves
 *   with it, unless the motion slides or tips it off"; the user's first example);
 * - its securing, where the scene model has one, as a carry line that holds even when tipped. Whether a prompt shows the securing is the
 *   caller's pre-processing (`withoutSecuring`, QS-4), never this render's;
 * - the default for everything unstated (the user's, with the gloss written in): "In everything the scene doesn't say, [table1] is as an
 *   ordinary small round tea table is."
 *
 * - with `rules: 'handles'` (AGENT.itemStanding.planning.md, IS-3), each securing's fact tagged with its rule's handle, " (rule [h])", so a
 *   reader can name the rule. The handle is minted from the securing edge in the full scene (`judgeRules(full)`), never from this render,
 *   so it is the same in every sub-scene. The default, `none`, is the render as it was, byte for byte.
 * - with `rules: 'conditions'` (AGENT.itemStanding.planning.md, step 2, the user's diagnosis, 2026-11-19), the handles, and each securing
 *   also as its condition, a rule's enforcing part said as what an action would have to do to violate it, with the relation's own words
 *   kept as its manner, so a chain keeps its slack. A pair with neither hosting the other gets a carry line of its own, in place of
 *   `actionRule`'s "cannot be moved apart", which read every securing as rigid. For an imagination piece, which is asked what an action
 *   brings about, never whether it can.
 *
 * The wording is provisional, pinned by `renderSceneExplicit.test.ts`. Shapes step 0 doesn't probe (a join, a spread thing, Concepts)
 * throw, rather than render a guess.
 */
import type { SceneEntry, SceneHandle, SceneModel, SceneRelation } from '../../positions/ludicCache/sceneModel'
import { listWords, sceneEntries } from './renderSceneRegisters'
import { judgeSceneSections } from './renderSceneJudge'
import { actionRule, hostsOf, judgeRules, securingWords, withoutSecuring } from './sceneRules'
import { bracket, headText, heading, hostingClause, relationPhrases, roomRef, targetWords } from './sceneWording'

type Placed = { entry: SceneEntry; place: string }

/** Every entry with its own place in words, in walk order: contents, then what is held. */
const placed = (scene: SceneModel): Placed[] => {
    const walk = (entries: readonly SceneEntry[], target: string, held: boolean): Placed[] => entries.flatMap((entry) => [
        { entry, place: held ? 'held by you' : hostingClause(entry.hostingKind, target) },
        ...walk(entry.children, bracket(entry.handle), false),
    ])
    return [...walk(scene.contents, roomRef(scene), false), ...walk(scene.held, 'you', true)]
}

const refuseUnprobed = (scene: SceneModel): void => {
    if (scene.concepts.length > 0) {
        throw new Error('The explicit render doesn\'t render Concepts yet')
    }
    sceneEntries(scene).forEach((entry) => {
        if (entry.kind === 'join') {
            throw new Error(`The explicit render doesn't render a join yet ([${entry.handle}])`)
        }
        if (entry.elsewhere.length > 0) {
            throw new Error(`The explicit render doesn't render a spread thing yet ([${entry.handle}])`)
        }
    })
}

/**
 * What the explicit render shows of the scene's rules: `none` (the default), or `handles`, each securing tagged with its rule's handle.
 * `full` is the scene the handles are minted from, by default the scene rendered; a caller rendering a sub-scene passes the full scene.
 */
export type ExplicitRenderOptions = { rules?: 'none' | 'handles' | 'conditions'; full?: SceneModel }

/** The tag after a securing's fact: ` (rule [h])`. */
const ruleTag = (handle: string): string => ` (rule ${bracket(handle)})`

/** The rule handles a rendered text tags (`ruleTag`), in order, each once: what a reader of the render was shown it can name. */
export const ruleTagHandles = (text: string): string[] => [...new Set([...text.matchAll(/ \(rule \[([^\]]+)\]\)/g)].map(([, handle]) => handle))]

/** A securing's tag under `rules: 'handles'`: its rule in the full scene, found by its edge. A target other than a thing has no form yet (IS-3). */
type SecuringTag = (subject: SceneHandle, relation: SceneRelation) => string

const securingTag = (full: SceneModel): SecuringTag => {
    const rules = judgeRules(full)
    return (subject, { target }) => {
        if (target.kind !== 'thing') {
            throw new Error(`The explicit render has no rule handle yet for a securing to ${targetWords(target)} ([${subject}])`)
        }
        const rule = rules.find((candidate) => candidate.subject === subject && candidate.target.kind === 'thing' && candidate.target.handle === target.handle)
        if (rule === undefined) {
            throw new Error(`No rule in the full scene for [${subject}]'s securing to [${target.handle}]`)
        }
        return ruleTag(rule.handle)
    }
}

/**
 * A securing's condition under `rules: 'conditions'`: what an action would have to do to violate its rule, with the relation's words as
 * the measure ("than being chained to it allows"), so the measure is the link's own. "Farther from", never "relative to" (`actionRule`).
 */
const conditionSentence = (one: SceneHandle, other: SceneHandle, words: string): string => (
    `If an action moves ${bracket(one)} farther from ${bracket(other)} than being ${words} it allows, that is a violation of the rule.`
)

/**
 * A securing as a carry line: a hosted end goes wherever its host goes; any other pair takes the action rule's sentences, or under
 * `conditions` its condition and a carry line that leaves the link its slack.
 */
const securedSentence = (subject: SceneHandle, relation: SceneRelation, words: string, hosts: Map<SceneHandle, Set<SceneHandle>>, tag?: SecuringTag, conditions = false): string => {
    const { target } = relation
    const fact = `${bracket(subject)} is ${words} ${targetWords(target)}${tag === undefined ? '' : tag(subject, relation)}`
    if (target.kind === 'thing' && hosts.get(subject)?.has(target.handle)) {
        const carry = `${fact}, so it goes wherever ${bracket(target.handle)} goes, even when ${bracket(target.handle)} is tipped.`
        return conditions ? `${carry} ${conditionSentence(subject, target.handle, words)}` : carry
    }
    if (target.kind === 'thing' && hosts.get(target.handle)?.has(subject)) {
        const carry = `${fact}, so ${bracket(target.handle)} goes wherever ${bracket(subject)} goes, even when ${bracket(subject)} is tipped.`
        return conditions ? `${carry} ${conditionSentence(target.handle, subject, words)}` : carry
    }
    if (conditions && target.kind === 'thing') {
        const [one, other] = [bracket(subject), bracket(target.handle)]
        return `${fact}. ${conditionSentence(subject, target.handle, words)} Short of that, ${one} can be moved as usual, and when ${other} moves, ${one} goes with it.`
    }
    return `${fact}. ${actionRule(subject, target, hosts)}`
}

/** The children secured to their host, in either direction of the securing relation. */
const securedToHost = (scene: SceneModel, hosts: Map<SceneHandle, Set<SceneHandle>>): Set<SceneHandle> => new Set(
    Object.entries(scene.things).flatMap(([subject, { relations }]) => relations.flatMap((relation) => {
        if (securingWords(relation) === undefined || relation.target.kind !== 'thing') {
            return []
        }
        const other = relation.target.handle
        return hosts.get(subject)?.has(other) ? [subject] : hosts.get(other)?.has(subject) ? [other] : []
    })),
)

const isAre = (count: number): string => (count === 1 ? 'is' : 'are')

/** What sits on or in a thing, one sentence per hosting kind, in the order the kinds first appear. */
const childGroups = (children: readonly SceneEntry[]): { hostingKind: SceneEntry['hostingKind']; handles: SceneHandle[] }[] => children.reduce<{ hostingKind: SceneEntry['hostingKind']; handles: SceneHandle[] }[]>(
    (groups, { hostingKind, handle }) => {
        const index = groups.findIndex((group) => group.hostingKind === hostingKind)
        return index >= 0
            ? groups.map((group, at) => (at === index ? { ...group, handles: [...group.handles, handle] } : group))
            : [...groups, { hostingKind, handles: [handle] }]
    },
    [],
)

/** The carry line for one kind of hosting, or none for a kind that doesn't carry (a part, a section). */
const carrySentence = (host: SceneHandle, hostingKind: SceneEntry['hostingKind'], handles: readonly SceneHandle[], secured: ReadonlySet<SceneHandle>): string[] => {
    if (hostingKind === 'PartOf' || hostingKind === 'SectionOf') {
        return []
    }
    const on = hostingKind === 'On'
    const loose = handles.filter((handle) => !secured.has(handle))
    if (loose.length === 0) {
        return []
    }
    const one = loose.length === 1
    const [what, verb, pronoun] = loose.length === handles.length
        ? [`what is ${on ? 'on' : 'in'} it`, 'moves', 'it']
        : [listWords(loose.map(bracket)), one ? 'moves' : 'move', one ? 'it' : 'them']
    return [`When ${bracket(host)} moves, ${what} ${verb} with it, unless the motion ${on ? `slides or tips ${pronoun} off` : `spills ${pronoun} out`}.`]
}

const groupSentence = ({ hostingKind, handles }: { hostingKind: SceneEntry['hostingKind']; handles: SceneHandle[] }): string => {
    const list = listWords(handles.map(bracket))
    switch (hostingKind) {
        case 'On': return `On it ${isAre(handles.length)} ${list}.`
        case 'PartOf':
        case 'SectionOf': return `${list} ${isAre(handles.length)} ${hostingClause(hostingKind, 'it')}.`
        default: return `In it ${isAre(handles.length)} ${list}.`
    }
}

/** "an ordinary small round tea table": the gloss without its article, or the name lowercased, or the kind. */
const ordinary = (scene: SceneModel, handle: SceneHandle): string => {
    const { gloss, name, kind } = scene.things[handle]
    const what = gloss !== undefined ? gloss.replace(/^(?:a|an|the)\s+/i, '') : (name ?? kind).toLowerCase()
    return `an ordinary ${what}`
}

const thingLine = (scene: SceneModel, { entry, place }: Placed, hosts: Map<SceneHandle, Set<SceneHandle>>, secured: ReadonlySet<SceneHandle>, loose: SceneModel, tag?: SecuringTag, conditions = false): string => {
    const { handle } = entry
    const relations = scene.things[handle].relations
    const securings = relations.flatMap((relation) => {
        const words = securingWords(relation)
        return words === undefined ? [] : [securedSentence(handle, relation, words, hosts, tag, conditions)]
    })
    const others = relationPhrases(loose, handle).map((phrase) => `${bracket(handle)} is ${phrase.replace(/^is /, '')}.`)
    const groups = childGroups(entry.children)
    return `- ${[
        `${headText(scene, entry)} is ${place}.`,
        ...securings,
        ...others,
        ...groups.map(groupSentence),
        ...groups.flatMap(({ hostingKind, handles }) => carrySentence(handle, hostingKind, handles, secured)),
        `In everything the scene doesn't say, ${bracket(handle)} is as ${ordinary(scene, handle)} is.`,
    ].join(' ')}`
}

export const renderSceneExplicit = (scene: SceneModel, { rules = 'none', full = scene }: ExplicitRenderOptions = {}): string => {
    refuseUnprobed(scene)
    const hosts = hostsOf(scene)
    const secured = securedToHost(scene, hosts)
    const loose = withoutSecuring(scene)
    const tag = rules === 'none' ? undefined : securingTag(full)
    const conditions = rules === 'conditions'
    return [
        `Scene: ${heading(scene)}`,
        judgeSceneSections(scene).fiction,
        ['The things:', ...placed(scene).map((item) => thingLine(scene, item, hosts, secured, loose, tag, conditions))].join('\n'),
        'End of scene.',
    ].join('\n\n')
}
