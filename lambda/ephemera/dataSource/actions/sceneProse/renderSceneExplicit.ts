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
 * The wording is provisional, pinned by `renderSceneExplicit.test.ts`. Shapes step 0 doesn't probe (a join, a spread thing, Concepts)
 * throw, rather than render a guess.
 */
import type { SceneEntry, SceneHandle, SceneModel, SceneRelation } from '../../positions/ludicCache/sceneModel'
import { listWords, sceneEntries } from './renderSceneRegisters'
import { judgeSceneSections } from './renderSceneJudge'
import { actionRule, hostsOf, securingWords, withoutSecuring } from './sceneRules'
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

/** A securing as a carry line: a hosted end goes wherever its host goes; any other pair takes the action rule's sentences. */
const securedSentence = (subject: SceneHandle, relation: SceneRelation, words: string, hosts: Map<SceneHandle, Set<SceneHandle>>): string => {
    const { target } = relation
    const fact = `${bracket(subject)} is ${words} ${targetWords(target)}`
    if (target.kind === 'thing' && hosts.get(subject)?.has(target.handle)) {
        return `${fact}, so it goes wherever ${bracket(target.handle)} goes, even when ${bracket(target.handle)} is tipped.`
    }
    if (target.kind === 'thing' && hosts.get(target.handle)?.has(subject)) {
        return `${fact}, so ${bracket(target.handle)} goes wherever ${bracket(subject)} goes, even when ${bracket(subject)} is tipped.`
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

const thingLine = (scene: SceneModel, { entry, place }: Placed, hosts: Map<SceneHandle, Set<SceneHandle>>, secured: ReadonlySet<SceneHandle>, loose: SceneModel): string => {
    const { handle } = entry
    const relations = scene.things[handle].relations
    const securings = relations.flatMap((relation) => {
        const words = securingWords(relation)
        return words === undefined ? [] : [securedSentence(handle, relation, words, hosts)]
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

export const renderSceneExplicit = (scene: SceneModel): string => {
    refuseUnprobed(scene)
    const hosts = hostsOf(scene)
    const secured = securedToHost(scene, hosts)
    const loose = withoutSecuring(scene)
    return [
        `Scene: ${heading(scene)}`,
        judgeSceneSections(scene).fiction,
        ['The things:', ...placed(scene).map((item) => thingLine(scene, item, hosts, secured, loose))].join('\n'),
        'End of scene.',
    ].join('\n\n')
}
